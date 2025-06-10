import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '@app/services/otp.service';
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
    EmailOrClientId,
    ResendForgotPasswordOtpRequestType,
    MpinVerifyRequestType,
    ForgotMpinRequestType,
    ForgotMpinOtpVerifyRequestType,
    NewMpinRequestType,
    ResendForgotMpinOtpRequestType,
} from './login.types';
import { ResponseWithToken, SessionJwtType } from '@app/modules/common.types';
import { hashPassword, verifyPassword } from '@app/utils/passwords';
import {
    sendPasswordChangeConfirmation,
    sendLoginAlert,
    sendMpinChangeConfirmation,
} from '@app/services/notification.service';

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response,
) => {
    const { password } = req.body;
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select([
            'user.id',
            'user.email',
            'user.phone',
            'user_name.first_name',
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

    const loginSessionId = randomUUID();
    const loginSession = {
        sessionId: loginSessionId,
        userId: user.id,
        email: user.email,
        userName: user.first_name,
        clientId: 'clientId' in req.body ? req.body.clientId : undefined,
        passwordVerified: true,
        otpVerified: false,
        mpinVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    const redisKey = `login_session:${loginSessionId}`;
    await redisClient.set(redisKey, JSON.stringify(loginSession));
    await redisClient.expire(redisKey, 10 * 60);

    const emailOtp = new EmailOtpVerification(user.email, 'login');
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'Password verified. OTP sent to your email.',
        data: {
            sessionId: loginSessionId,
            nextStep: 'otp',
        },
    });
};

// Verify the OTP for the login
const verifyLoginOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginOtpVerifyRequestType>,
    res: Response,
) => {
    const { otp, sessionId } = req.body;

    const redisKey = `login_session:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Login session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Login session already used');
    }

    if (!session.passwordVerified) {
        throw new UnauthorizedError('Password verification required first');
    }

    if (session.otpVerified) {
        throw new UnauthorizedError('OTP already verified');
    }

    const requestClientId = 'clientId' in req.body ? req.body.clientId : undefined;
    const requestEmail = 'email' in req.body ? req.body.email : undefined;

    if (requestClientId && session.clientId !== requestClientId) {
        throw new UnauthorizedError('Invalid login session - client ID mismatch');
    }
    if (requestEmail && session.email !== requestEmail) {
        throw new UnauthorizedError('Invalid login session - email mismatch');
    }

    const emailOtp = new EmailOtpVerification(session.email, 'login');
    await emailOtp.verifyOtp(otp);

    // Mark OTP as verified
    session.otpVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    res.status(OK).json({
        message: 'OTP verified. Please enter MPIN.',
        data: {
            sessionId,
            nextStep: 'mpin',
        },
    });
};

// resend-login OTP

const resendLoginOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, EmailOrClientId>,
    res: Response,
) => {
    const user = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user.id', 'user.email', 'user_name.first_name'])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }
            return qb;
        })
        .executeTakeFirstOrThrow();

    const emailOtp = new EmailOtpVerification(user.email, 'login');
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'OTP resent successfully.',
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
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select([
            'user.id',
            'user.email',
            'user_name.first_name',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.password_salt as salt',
            'hashing_algorithm.name as hashAlgo',
        ])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user);

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

    // Send password change confirmation email using notification service
    await sendPasswordChangeConfirmation(user.email, {
        userName: user.first_name,
        email: user.email,
        ip: req.ip || req.connection.remoteAddress || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location', // You can add geolocation if needed
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
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user.id', 'user.email', 'user_name.first_name'])
        .where('pan_detail.pan_number', '=', panNumber)
        .executeTakeFirstOrThrow();

    // generate a requestID
    const requestId = randomUUID();

    // Create a session
    const session = {
        requestId,
        userId: user.id,
        email: user.email,
        userName: user.first_name,
        isVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    // store in redis
    const redisKey = `forgot_password:${requestId}`;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 15 * 60);

    const emailOtp = new EmailOtpVerification(user.email, 'forgot-password');
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
    const { requestId, emailOtp } = req.body;
    const redisKey = `forgot_password:${requestId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Session expired or invalid');
    }

    const session = JSON.parse(sessionStr);
    if (session.isVerified || session.isUsed) {
        throw new UnauthorizedError('Session already verified or used');
    }

    const emailOtpInstance = new EmailOtpVerification(session.email, 'forgot-password');
    await emailOtpInstance.verifyOtp(emailOtp);

    session.isVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({ message: 'OTP verified. Proceed to reset password.' });
};

// resend-forgot-OTP
const resendForgotPasswordOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ResendForgotPasswordOtpRequestType>,
    res: Response,
) => {
    const { requestId } = req.body;
    const redisKey = `forgot_password:${requestId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Session already used');
    }

    const emailOtp = new EmailOtpVerification(session.email, 'forgot-password');
    await emailOtp.sendOtp();

    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({
        message: 'OTP resent successfully',
        data: { maskedEmail: session.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') },
    });
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

    // mark the session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 5 * 60);

    // Send password change confirmation email using data from session
    await sendPasswordChangeConfirmation(session.email, {
        userName: session.userName,
        email: session.email,
        ip: req.ip || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location',
    });

    res.status(OK).json({ message: 'Password reset successful' });
};

const verifyMpin = async (
    req: Request<undefined, ParamsDictionary, ResponseWithToken, MpinVerifyRequestType>,
    res: Response<ResponseWithToken>,
) => {
    const { mpin, sessionId } = req.body;

    const redisKey = `login_session:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Login session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Login session already used');
    }

    if (!session.passwordVerified) {
        throw new UnauthorizedError('Password verification required first');
    }

    if (session.mpinVerified) {
        throw new UnauthorizedError('MPIN already verified');
    }

    if (!session.otpVerified) {
        throw new UnauthorizedError('OTP verification required first');
    }

    const userId = session.userId;

    const mpinRecord = await db
        .selectFrom('user_mpin')
        .innerJoin('hashing_algorithm', 'user_mpin.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user_mpin.mpin_hash as hashedPassword',
            'user_mpin.mpin_salt as salt',
            'user_mpin.is_active',
            'user_mpin.failed_attempts',
            'hashing_algorithm.name as hashAlgo',
        ])
        .where('user_mpin.client_id', '=', userId)
        .executeTakeFirst();

    if (!mpinRecord) {
        throw new UnauthorizedError('MPIN not set for this user');
    }

    if (!mpinRecord.is_active) {
        throw new UnauthorizedError('MPIN is disabled for this user');
    }

    if (mpinRecord.failed_attempts >= 3) {
        throw new UnauthorizedError('MPIN is locked due to too many failed attempts');
    }

    const authenticated = await verifyPassword(mpin, {
        hashedPassword: mpinRecord.hashedPassword,
        salt: mpinRecord.salt,
        hashAlgo: mpinRecord.hashAlgo,
    });

    if (!authenticated) {
        await db
            .updateTable('user_mpin')
            .set({
                failed_attempts: mpinRecord.failed_attempts + 1,
                last_failed_attempt: new Date(),
                updated_at: new Date(),
            })
            .where('client_id', '=', userId)
            .execute();

        throw new UnauthorizedError('Invalid MPIN');
    }

    await db
        .updateTable('user_mpin')
        .set({
            failed_attempts: 0,
            last_failed_attempt: null,
            updated_at: new Date(),
        })
        .where('client_id', '=', userId)
        .execute();

    session.mpinVerified = true;
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user_password_details.user_id', 'user.id')
        .select(['user.id', 'user.email', 'user_password_details.is_first_login'])
        .where('user.id', '=', session.userId)
        .executeTakeFirstOrThrow();

    // Generate token
    const token = sign<SessionJwtType>({
        userId: session.userId,
    });

    await sendLoginAlert(session.email, {
        userName: session.userName,
        email: session.email,
        ip: req.ip || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location',
    });

    res.status(OK).json({
        message: 'MPIN verification successful. Login complete.',
        token,
        data: {
            isFirstLogin: user.is_first_login,
        },
    });
};

const forgotMpinInitiate = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotMpinRequestType>,
    res: Response,
) => {
    const user = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user.id', 'user.email', 'user_name.first_name'])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }
            return qb;
        })
        .executeTakeFirstOrThrow();

    const mpinExists = await db
        .selectFrom('user_mpin')
        .select('id')
        .where('client_id', '=', user.id)
        .executeTakeFirst();

    if (!mpinExists) {
        throw new UnauthorizedError('MPIN not set for this user');
    }

    const requestId = randomUUID();

    // Create a session
    const session = {
        requestId,
        userId: user.id,
        email: user.email,
        userName: user.first_name,
        isVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    const redisKey = `forgot_mpin:${requestId}`;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 15 * 60);

    const emailOtp = new EmailOtpVerification(user.email, 'forgot-mpin');
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'OTP sent to your registered email for MPIN reset',
        data: { requestId, maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') },
    });
};

// Forgot MPIN - Verify OTP
const forgotMpinOtpVerify = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotMpinOtpVerifyRequestType>,
    res: Response,
) => {
    const { requestId, emailOtp } = req.body;
    const redisKey = `forgot_mpin:${requestId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Session expired or invalid');
    }

    const session = JSON.parse(sessionStr);
    if (session.isVerified || session.isUsed) {
        throw new UnauthorizedError('Session already verified or used');
    }

    const emailOtpInstance = new EmailOtpVerification(session.email, 'forgot-mpin');
    await emailOtpInstance.verifyOtp(emailOtp);

    session.isVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({ message: 'OTP verified. You can now set a new MPIN.' });
};

// Forgot MPIN - Resend OTP
const resendForgotMpinOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ResendForgotMpinOtpRequestType>,
    res: Response,
) => {
    const { requestId } = req.body;
    const redisKey = `forgot_mpin:${requestId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Session already used');
    }

    const emailOtp = new EmailOtpVerification(session.email, 'forgot-mpin');
    await emailOtp.sendOtp();

    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({
        message: 'OTP resent successfully',
        data: { maskedEmail: session.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') },
    });
};

// Forgot MPIN - Reset MPIN
const forgotMpinReset = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, NewMpinRequestType>,
    res: Response,
) => {
    const { requestId, newMpin } = req.body;

    const redisKey = `forgot_mpin:${requestId}`;

    const sessionStr = await redisClient.get(redisKey);
    if (!sessionStr) throw new UnauthorizedError('Session expired or invalid');

    const session = JSON.parse(sessionStr);

    if (!session.isVerified || session.isUsed) {
        throw new UnauthorizedError('OTP not verified or already used');
    }

    // Hash the new MPIN
    const hashedMpin = await hashPassword(newMpin, 'bcrypt');

    const hashAlgoRecord = await db
        .selectFrom('hashing_algorithm')
        .select('id')
        .where('name', '=', hashedMpin.hashAlgo)
        .executeTakeFirstOrThrow();

    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('user_mpin')
            .set({
                mpin_hash: hashedMpin.hashedPassword,
                mpin_salt: hashedMpin.salt,
                hash_algo_id: hashAlgoRecord.id,
                failed_attempts: 0,
                last_failed_attempt: null,
                is_active: true,
                updated_at: new Date(),
            })
            .where('client_id', '=', session.userId)
            .execute();
    });

    // Mark the session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));
    await redisClient.expire(redisKey, 5 * 60);

    // Send MPIN change confirmation email
    await sendMpinChangeConfirmation(session.email, {
        userName: session.userName,
        email: session.email,
        ip: req.ip || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location',
    });

    res.status(OK).json({ message: 'MPIN reset successful' });
};

export {
    login,
    verifyLoginOtp,
    verifyMpin,
    resendLoginOtp,
    resetPassword,
    forgotPasswordInitiate,
    resendForgotPasswordOtp,
    forgotOTPverify,
    forgotPasswordReset,
    forgotMpinInitiate,
    forgotMpinOtpVerify,
    resendForgotMpinOtp,
    forgotMpinReset,
};
