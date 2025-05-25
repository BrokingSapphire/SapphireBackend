import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '../signup/signup.services';
import { randomUUID } from 'crypto';
import { UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { sign } from '@app/utils/jwt';
import { OK } from '@app/utils/httpstatus';
import {
    LoginRequestType,
    ResetPasswordRequestType,
    LoginOtpVerifyRequestType,
    ForgotPasswordRequestType,
    ForgotOTPVerifyRequestType,
    NewPasswordRequestType,
} from './login.types';
import { ResponseWithToken, SessionJwtType } from '@app/modules/common.types';
import { hashPassword, verifyPassword } from '@app/utils/passwords';

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response,
) => {
    const { password } = req.body;
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user.id',
            'user.email',
            'user.phone',
            'hashing_algorithm.name as hashAlgo',
            'user_password_details.password_salt as salt',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.is_first_login',
        ])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }

            return qb;
        })
        .executeTakeFirstOrThrow();

    const authenticated = await verifyPassword(password, user);

    if (!authenticated) {
        throw new UnauthorizedError('Invalid credentials');
    }

    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'OTP sent.',
    });
};

// Verify the OTP for the login
const verifyLoginOtp = async (
    req: Request<undefined, ParamsDictionary, ResponseWithToken, LoginOtpVerifyRequestType>,
    res: Response<ResponseWithToken>,
) => {
    const { otp } = req.body;

    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user_password_details.user_id', 'user.id')
        .select(['user.id', 'user.email', 'user_password_details.is_first_login'])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }
            return qb;
        })
        .executeTakeFirstOrThrow();

    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.verifyOtp(otp);

    const token = sign<SessionJwtType>({
        userId: user.id,
    });

    res.status(OK).json({
        message: 'Login successful',
        token,
        data: {
            isFirstLogin: user.is_first_login,
        },
    });
};

// reset password
const resetPassword = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, ResetPasswordRequestType>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { currentPassword, newPassword } = req.body;

    // Fetch user details
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user.id',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.password_salt as salt',
            'hashing_algorithm.name as hashAlgo',
        ])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Verify current password
    const isCurrentPasswordValid = verifyPassword(currentPassword, user);

    if (!isCurrentPasswordValid) {
        throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword, 'bcrypt');

    // Update the user's password
    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('user_password_details')
            .set({
                password_hash: hashedPassword.hashedPassword,
                password_salt: hashedPassword.salt,
            })
            .where('user_id', '=', userId)
            .execute();
    });

    res.status(OK).json({
        message: 'Password reset successful',
    });
};

// forgot password-initate
const forgotPasswordInitiate = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotPasswordRequestType>,
    res: Response,
) => {
    const { panNumber } = req.body;

    const user = await db
        .selectFrom('user')
        .innerJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select(['user.id', 'user.email'])
        .where('pan_detail.pan_number', '=', panNumber)
        .executeTakeFirstOrThrow();

    // generate a requestID
    const requestId = randomUUID();

    // Create a session
    const session = {
        requestId,
        userId: user.id,
        email: user.email,
        isVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    // store in redis
    const redisKey = `forgot_password:${requestId}`;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 15 * 60);

    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'OTP sent to your registered email',
        data: { requestId, maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') },
    });
};

// Verify Forgot password OTP

const forgotOTPverify = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotOTPVerifyRequestType>,
    res: Response,
) => {
    const { requestId, otp } = req.body;
    const redisKey = `forgot_password:${requestId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Session expired or invalid');
    }

    const session = JSON.parse(sessionStr);
    if (session.isVerified || session.isUsed) {
        throw new UnauthorizedError('Session already verified or used');
    }

    const emailOtp = new EmailOtpVerification(session.email);
    await emailOtp.verifyOtp(otp);

    session.isVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({ message: 'OTP verified. Proceed to reset password.' });
};

// password reset

const forgotPasswordReset = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, NewPasswordRequestType>,
    res: Response,
) => {
    const { requestId, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        throw new UnauthorizedError('Passwords do not match');
    }

    const redisKey = `forgot_password:${requestId}`;

    const sessionStr = await redisClient.get(redisKey);
    if (!sessionStr) throw new UnauthorizedError('Session expired or invalid');

    const session = JSON.parse(sessionStr);

    if (!session.isVerified || session.isUsed) {
        throw new UnauthorizedError('OTP not verified or already used');
    }

    // hash the password
    const hashed = await hashPassword(newPassword, 'bcrypt');
    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('user_password_details')
            .set({
                password_hash: hashed.hashedPassword,
                password_salt: hashed.salt,
                is_first_login: false,
            })
            .where('user_id', '=', session.userId)
            .execute();
    });

    // mark the newpassword set to true
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 5 * 60);

    res.status(OK).json({ message: 'Password reset successful' });
};

export { login, verifyLoginOtp, resetPassword, forgotPasswordInitiate, forgotOTPverify, forgotPasswordReset };
