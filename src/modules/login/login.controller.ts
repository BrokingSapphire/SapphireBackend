import { ParamsDictionary } from 'express-serve-static-core';
import {
    Response,
    DefaultResponseData,
    Request,
    LoginResponseWithToken,
    LoginRequestType,
    ResetPasswordRequestType,
    ForgotPasswordInitiateRequestType,
    ForgotPasswordInitiateResponseType,
    ForgotPasswordVerifyOtpRequestType,
    ForgotPasswordVerifyOtpResponseType,
    ForgotPasswordResetRequestType,
    LoginInitiateResponseType,
    LoginOtpVerifyRequestType,
} from '@app/types.d';
import { EmailOtpVerification, PhoneOtpVerification, OTP_LENGTH } from '../signup/signup.services';
import { UnauthorizedError } from '@app/apiError';
import redisClient from '@app/services/redis.service';
import { randomUUID } from 'crypto';
import { db } from '@app/database';
import { sign } from '@app/utils/jwt';
import bcrypt from 'bcrypt';
import { OK } from '@app/utils/httpstatus';

import { LoginJwtType } from './login.types';

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response<LoginResponseWithToken | LoginInitiateResponseType>,
) => {
    const { clientId, password } = req.body;
    const user = await db
        .selectFrom('user')
        .leftJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select([
            'user.id',
            'user.client_id',
            'user.email',
            'user.phone',
            'user.password',
            'user.is_first_login',
            'pan_detail.pan_number',
        ])
        .where('user.client_id', '=', clientId)
        .executeTakeFirstOrThrow();

    let isAuthenticated = false;
    let isFirstLogin = false;

    // Check if first login (password will be PAN)
    if (user.is_first_login) {
        isFirstLogin = true;
        isAuthenticated = user.pan_number === password;
    } else {
        // Verify password hash
        isAuthenticated = !!user.password && (await bcrypt.compare(password, user.password));
    }

    if (!isAuthenticated) {
        throw new UnauthorizedError('Invalid credentials');
    }

    if (isFirstLogin) {
        const token = sign({ clientId: user.client_id, userId: user.id });

        res.status(OK).json({
            message: 'Login successful',
            token,
            isFirstLogin,
        });
    } else {
        // user changed password and OTP required for login
        const phoneData = await db
            .selectFrom('phone_number')
            .select('phone')
            .where('id', '=', user.phone)
            .executeTakeFirstOrThrow();
        // Generate a random request ID
        const requestId = randomUUID();

        // Generate a single OTP for both email and phone
        const min = Math.pow(10, OTP_LENGTH - 1);
        const max = Math.pow(10, OTP_LENGTH) - 1;
        const singleOtp = Math.floor(min + Math.random() * (max - min)).toString();

        // Store the information in Redis
        await redisClient.set(
            `login-otp:${requestId}`,
            JSON.stringify({
                userId: user.id,
                clientId: user.client_id,
                email: user.email,
                phone: phoneData.phone,
                singleOtp,
            }),
        );
        await redisClient.expire(`login-otp:${requestId}`, 60 * 5);

        // Store OTP for email and phone verification
        const emailKey = `otp:${user.email}`;
        const phoneKey = `otp:${phoneData.phone}`;

        await redisClient.set(emailKey, singleOtp);
        await redisClient.expire(emailKey, 10 * 60); // 10 mins expiry

        await redisClient.set(phoneKey, singleOtp);
        await redisClient.expire(phoneKey, 10 * 60); // 10 mins expiry

        // Send OTP to email and phone
        const emailOtp = new EmailOtpVerification(user.email);
        await emailOtp.sendOtp();

        const phoneOtp = new PhoneOtpVerification(user.email, phoneData.phone);
        await phoneOtp.sendOtp();

        // Return request ID for OTP verification
        res.status(OK).json({
            message: 'OTP sent to your registered email and phone number',
            requestId,
            isFirstLogin,
        });
    }
};

// Verify the OTP for the login
const verifyLoginOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginOtpVerifyRequestType>,
    res: Response<LoginResponseWithToken>,
) => {
    const { requestId, otp } = req.body;

    // Get the login OTP data from Redis
    const loginOtpDataStr = await redisClient.get(`login-otp:${requestId}`);
    if (!loginOtpDataStr) {
        throw new UnauthorizedError('Invalid or expired OTP request');
    }

    const loginOtpData = JSON.parse(loginOtpDataStr);

    // Verify OTP
    if (otp !== loginOtpData.singleOtp) {
        throw new UnauthorizedError('Invalid OTP');
    }

    // Clean up Redis entries
    await redisClient.del(`login-otp:${requestId}`);
    await redisClient.del(`otp:${loginOtpData.email}`);
    await redisClient.del(`otp:${loginOtpData.phone}`);

    // Generate JWT token
    const token = sign({
        clientId: loginOtpData.clientId,
        userId: loginOtpData.userId,
    });

    // Return success with token
    res.status(OK).json({
        message: 'Login successful',
        token,
        isFirstLogin: false,
    });
};

// reset password
const resetPassword = async (
    req: Request<LoginJwtType, ParamsDictionary, DefaultResponseData, ResetPasswordRequestType>,
    res: Response,
) => {
    const { clientId, userId } = req.auth!!;
    const { currentPassword, newPassword } = req.body;
    const user = await db
        .selectFrom('user')
        .leftJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select(['user.id', 'user.password', 'user.is_first_login', 'pan_detail.pan_number'])
        .where('user.client_id', '=', clientId)
        .executeTakeFirstOrThrow();

    let isAuthenticated = false;

    // Verify current password
    if (user.is_first_login) {
        isAuthenticated = user.pan_number === currentPassword;
    } else {
        isAuthenticated = !!user.password && (await bcrypt.compare(currentPassword, user.password));
    }

    if (!isAuthenticated) {
        throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and set is_first_login to false
    await db
        .updateTable('user')
        .set({
            password: hashedPassword,
            is_first_login: false,
            updated_at: new Date(),
        })
        .where('id', '=', userId)
        .execute();

    res.status(OK).json({
        message: 'Password reset successful',
    });
};

const initiatePasswordReset = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotPasswordInitiateRequestType>,
    res: Response<ForgotPasswordInitiateResponseType>,
) => {
    const { panNumber } = req.body;

    // finding user by pan number
    const user = await db
        .selectFrom('user')
        .leftJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select([
            'user.id',
            'user.client_id',
            'user.email',
            'user.phone',
            'user.is_first_login',
            'pan_detail.pan_number',
        ])
        .where('pan_detail.pan_number', '=', panNumber)
        .executeTakeFirstOrThrow();

    const phoneData = await db
        .selectFrom('phone_number')
        .select('phone')
        .where('id', '=', user.phone)
        .executeTakeFirstOrThrow();

    // Generate a random id
    const requestId = randomUUID();

    // generating Single OTP for email and phone
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    const singleOtp = Math.floor(min + Math.random() * (max - min)).toString();

    // Storing info in redis
    await redisClient.set(
        `password-reset:${requestId}`,
        JSON.stringify({
            userId: user.id,
            clientId: user.client_id,
            email: user.email,
            phone: phoneData.phone,
            singleOtp,
            verified: {
                email: false,
                phone: false,
            },
        }),
    );

    await redisClient.expire(`password-reset:${requestId}`, 60 * 5); // 10 mins expiry

    const emailKey = `otp:${user.email}`;
    const phoneKey = `otp:${phoneData.phone}`;

    await redisClient.set(emailKey, singleOtp);
    await redisClient.expire(emailKey, 10 * 60); // 10 mins expiry

    await redisClient.set(phoneKey, singleOtp);
    await redisClient.expire(phoneKey, 10 * 60); // 10 mins expiry

    // send OTP to email and phone
    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.sendOtp();

    const phoneOtp = new PhoneOtpVerification(user.email, phoneData.phone);
    await phoneOtp.sendOtp();

    res.status(OK).json({
        message: 'OTPs sent to your email and phone',
        requestId,
    });
};

const verifyPasswordResetOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotPasswordVerifyOtpRequestType>,
    res: Response<ForgotPasswordVerifyOtpResponseType>,
) => {
    const { requestId, emailOtp, phoneOtp } = req.body;

    const resetDataStr = await redisClient.get(`password-reset:${requestId}`);
    if (!resetDataStr) {
        throw new UnauthorizedError('Invalid or expired password reset request');
    }

    const resetData = JSON.parse(resetDataStr);

    // Verify email OTP
    if (emailOtp !== resetData.singleOtp) {
        throw new UnauthorizedError('Invalid email OTP');
    }

    // Update the verification status in Redis
    resetData.verified.email = true;

    // Verify phone OTP
    if (phoneOtp !== resetData.singleOtp) {
        throw new UnauthorizedError('Invalid phone OTP');
    }

    // Update the verification status in Redis
    resetData.verified.phone = true;
    await redisClient.set(`password-reset:${requestId}`, JSON.stringify(resetData));

    // Clean up the OTPs from Redis
    await redisClient.del(`otp:${resetData.email}`);
    await redisClient.del(`otp:${resetData.phone}`);

    const token = sign({
        clientId: resetData.clientId,
        userId: resetData.userId,
        requestId,
    });

    res.status(OK).json({
        message: 'OTP verification successful',
        token,
    });
};

const completePasswordReset = async (
    req: Request<any, ParamsDictionary, DefaultResponseData, ForgotPasswordResetRequestType>,
    res: Response,
) => {
    const { clientId, userId, requestId } = req.auth!!;
    const { newPassword } = req.body;

    // Validate token contains required fields
    if (!req.auth?.clientId || !req.auth?.userId || !req.auth?.requestId) {
        throw new UnauthorizedError('Invalid token format for password reset');
    }

    // Verify that the request is still valid
    const resetDataStr = await redisClient.get(`password-reset:${requestId}`);
    if (!resetDataStr) {
        throw new UnauthorizedError('Invalid or expired password reset request');
    }

    const resetData = JSON.parse(resetDataStr);

    // Ensure both email and phone OTPs have been verified
    if (!resetData.verified.email || !resetData.verified.phone) {
        throw new UnauthorizedError('OTP verification incomplete');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await db
        .updateTable('user')
        .set({
            password: hashedPassword,
            is_first_login: false,
            updated_at: new Date(),
        })
        .where('id', '=', userId)
        .execute();

    // Clean up the Redis entry
    await redisClient.del(`password-reset:${requestId}`);

    res.status(OK).json({
        message: 'Password reset successful',
    });
};

export { login, verifyLoginOtp, resetPassword, initiatePasswordReset, verifyPasswordResetOtp, completePasswordReset };
