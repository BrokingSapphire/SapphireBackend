import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '@app/services/otp.service';
import { randomUUID } from 'crypto';
import { UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { sign } from '@app/utils/jwt';
import { OK } from '@app/utils/httpstatus';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import {
    LoginRequestType,
    ResetPasswordRequestType,
    ForgotPasswordRequestType,
    ForgotOTPVerifyRequestType,
    NewPasswordRequestType,
    ResendForgotPasswordOtpRequestType,
    MpinVerifyRequestType,
    ForgotMpinRequestType,
    ForgotMpinOtpVerifyRequestType,
    NewMpinRequestType,
    ResendForgotMpinOtpRequestType,
    Verify2FARequestType,
} from './login.types';
import { TwoFactorMethod } from '../accounts/general/general.types';
import { ResponseWithToken, SessionJwtType } from '@app/modules/common.types';
import { hashPassword, verifyPassword } from '@app/utils/passwords';
import { PhoneOtpVerification } from '@app/services/otp.service';
import {
    sendPasswordChangeConfirmation,
    sendLoginAlert,
    sendMpinChangeConfirmation,
} from '@app/services/notification.service';
import { SmsTemplateType } from '@app/services/sms-templates/sms.types';
import smsService from '@app/services/sms.service';
import logger from '@app/logger';

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
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select([
            'user.id',
            'user.email',
            'user.phone',
            'user_name.first_name',
            'hashing_algorithm.name as hashAlgo',
            'user_password_details.password_salt as salt',
            'user_password_details.password_hash as hashedPassword',
            'phone_number.phone',
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

    const user2FA = await db
        .selectFrom('user_2fa')
        .select(['method'])
        .where('user_id', '=', user.id)
        .executeTakeFirst();

    const loginSessionId = randomUUID();
    const loginSession = {
        sessionId: loginSessionId,
        userId: user.id,
        email: user.email,
        userName: user.first_name,
        clientId: 'clientId' in req.body ? req.body.clientId : undefined,
        passwordVerified: true,
        twoFactorVerified: false,
        mpinVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    const redisKey = `login_session:${loginSessionId}`;
    await redisClient.set(redisKey, JSON.stringify(loginSession));
    await redisClient.expire(redisKey, 10 * 60);

    if(user2FA && user2FA.method !== 'disabled'){

        const method = user2FA.method as TwoFactorMethod;

        if (method === TwoFactorMethod.SMS_OTP) {

            const phoneStr = String(user.phone);

            const smsOtp = new PhoneOtpVerification(user.email, '2fa-login', phoneStr);
            await smsOtp.sendOtp();

            const otpKey = `phone-otp:2fa-login:${user.phone}`;
    const otp = await redisClient.get(otpKey);
    
    // Send SMS using the 2FA template
    try {
        if (otp) {
            await smsService.sendTemplatedSms(phoneStr, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [otp]);
            logger.info(`2FA OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send 2FA OTP SMS: ${error}`);
    }
            
            res.status(OK).json({
                message: 'Password verified. SMS OTP sent for 2FA verification.',
                data: {
                    sessionId: loginSessionId,
                    nextStep: '2fa',
                    twoFactorMethod: method,
                },
            });
        }else {

            const user2FADetails = await db
                .selectFrom('user_2fa')
                .select(['secret'])
                .where('user_id', '=', user.id)
                .executeTakeFirst();

            let qrCodeUrl;
            if (user2FADetails?.secret) {
                const secretObj = speakeasy.generateSecret({
                    name: `Sapphire (${user.email})`,
                    issuer: 'Sapphire Trading',
                });

                secretObj.base32 = user2FADetails.secret;
                
                qrCodeUrl = await QRCode.toDataURL(secretObj.otpauth_url!);
            }

            res.status(OK).json({
                message: 'Password verified. Please enter your authenticator code.',
                data: {
                    sessionId: loginSessionId,
                    nextStep: '2fa',
                    twoFactorMethod: method,
                    qrCodeUrl,
                    manualEntryKey: user2FADetails?.secret,
                },
            });
        }
        return;
    }
    res.status(OK).json({
        message: 'Password verified. Please enter your MPIN.',
        data: {
            sessionId: loginSessionId,
            nextStep: 'mpin',
        },
    });
};

// Verify 2FA during login
const verify2FA = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, Verify2FARequestType>,
    res: Response,
) => {
    const { sessionId, token } = req.body;

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

    if (session.twoFactorVerified) {
        throw new UnauthorizedError('2FA already verified');
    }

    // Get user's 2FA configuration
    const user2FA = await db
        .selectFrom('user_2fa')
        .innerJoin('user', 'user_2fa.user_id', 'user.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user_2fa.method', 'user_2fa.secret', 'phone_number.phone', 'user.email'])
        .where('user_2fa.user_id', '=', session.userId)
        .executeTakeFirst();

    if (!user2FA) {
        throw new UnauthorizedError('2FA is not enabled for this account');
    }

    const method = user2FA.method as TwoFactorMethod;
    let verified = false;

    if (method === TwoFactorMethod.SMS_OTP) {
        // Verify SMS OTP
        const smsOtp = new PhoneOtpVerification(user2FA.email, '2fa-login' as any, user2FA.phone);
        try {
            await smsOtp.verifyOtp(token);
            verified = true;
        } catch (error) {
            throw new UnauthorizedError('Invalid SMS OTP');
        }
    } else if (method === TwoFactorMethod.AUTHENTICATOR) {
        // Verify Authenticator token
        verified = speakeasy.totp.verify({
            secret: user2FA.secret!,
            encoding: 'base32',
            token,
            window: 2,
        });

        if (!verified) {
            throw new UnauthorizedError('Invalid authenticator token');
        }
    } else {
        throw new UnauthorizedError('Invalid 2FA method');
    }

    if (!verified) {
        throw new UnauthorizedError('Invalid 2FA token');
    }

    session.twoFactorVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    res.status(OK).json({
        message: '2FA verified. Please enter your MPIN.',
        data: {
            sessionId,
            nextStep: 'mpin',
        },
    });
};

const send2FALoginOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, { sessionId: string }>,
    res: Response<DefaultResponseData>,
) => {
    const { sessionId } = req.body;

    const redisKey = `login_session:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Login session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (!session.passwordVerified) {
        throw new UnauthorizedError('Password verification required first');
    }

    // Get user's 2FA configuration
    const user2FA = await db
        .selectFrom('user_2fa')
        .innerJoin('user', 'user_2fa.user_id', 'user.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user_2fa.method', 'phone_number.phone', 'user.email'])
        .where('user_2fa.user_id', '=', session.userId)
        .executeTakeFirst();

    if (!user2FA) {
        throw new UnauthorizedError('2FA is not enabled for this account');
    }

    if (user2FA.method !== TwoFactorMethod.SMS_OTP) {
        throw new UnauthorizedError('SMS OTP is not enabled for this account');
    }

    // Send SMS OTP
    const smsOtp = new PhoneOtpVerification(user2FA.email, '2fa-login' as any, user2FA.phone);
    await smsOtp.sendOtp();

    const otpKey = `phone-otp:2fa-login:${user2FA.phone}`;
    const otp = await redisClient.get(otpKey);

    try {
        if (otp) {
            await smsService.sendTemplatedSms(user2FA.phone, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [otp]);
            logger.info(`2FA OTP SMS resent to ${user2FA.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to resend 2FA OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent for 2FA verification',
        data: {
            maskedPhone: user2FA.phone.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3'),
        },
    });
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

    // Check if 2FA was required and verified
    const user2FA = await db
        .selectFrom('user_2fa')
        .select(['method'])
        .where('user_id', '=', session.userId)
        .executeTakeFirst();

    if (user2FA && user2FA.method !== 'disabled') {
        if (!session.twoFactorVerified) {
            throw new UnauthorizedError('2FA verification required first');
        }
    }

    if (session.mpinVerified) {
        throw new UnauthorizedError('MPIN already verified');
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

    // Complete the login
    session.mpinVerified = true;
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

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
        message: 'Login successful',
        token,
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
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select([
            'user.id',
            'user.email',
            'user_name.first_name',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.password_salt as salt',
            'hashing_algorithm.name as hashAlgo',
            'phone_number.phone',
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

    try {
        if (user.phone) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION, [
                user.first_name,
            ]);
            logger.info(`Password change confirmation SMS sent to ${user.phone}`);
        }
    } catch (error) {
        // Log error but don't fail the password reset process if SMS fails
        logger.error(`Failed to send password change confirmation SMS: ${error}`);
    }
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
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.id', 'user.email', 'user_name.first_name', 'phone_number.phone'])
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

    const otpKey = `email-otp:forgot-password:${user.email}`;
    const otp = await redisClient.get(otpKey);

    // Send OTP via SMS if phone number and OTP are available
    try {
        if (user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.TERMINAL_PWD_RESET_OTP, [otp]);
            logger.info(`Password reset OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send password reset OTP SMS: ${error}`);
    }

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

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['phone_number.phone'])
        .where('user.id', '=', session.userId)
        .executeTakeFirst();

    const emailOtp = new EmailOtpVerification(session.email, 'forgot-password');
    await emailOtp.sendOtp();

    const otpKey = `email-otp:forgot-password:${session.email}`;
    const otp = await redisClient.get(otpKey);

    // Send OTP via SMS if phone number and OTP are available
    try {
        if (user && user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.TERMINAL_PWD_RESET_OTP, [otp]);
            logger.info(`Password reset OTP SMS resent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to resend password reset OTP SMS: ${error}`);
    }

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

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['phone_number.phone', 'user_name.first_name'])
        .where('user.id', '=', session.userId)
        .executeTakeFirst();

    // hash the password
    const hashed = await hashPassword(newPassword, 'bcrypt');
    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('user_password_details')
            .set({
                password_hash: hashed.hashedPassword,
                password_salt: hashed.salt,
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
    try {
        if (user && user.phone) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION, [
                user.first_name || session.userName,
            ]);
            logger.info(`Password change confirmation SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send password change confirmation SMS: ${error}`);
    }

    res.status(OK).json({ message: 'Password reset successful' });
};

const forgotMpinInitiate = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ForgotMpinRequestType>,
    res: Response,
) => {
    const user = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.id', 'user.email', 'user_name.first_name', 'phone_number.phone'])
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

    const otpKey = `email-otp:forgot-mpin:${user.email}`;
    const otp = await redisClient.get(otpKey);

    try {
        if (user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.FORGET_MPIN, [otp]);
            logger.info(`MPIN reset OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send MPIN reset OTP SMS: ${error}`);
    }

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

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['phone_number.phone', 'user_name.first_name'])
        .where('user.id', '=', session.userId)
        .executeTakeFirst();

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

    try {
        if (user && user.phone) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION, [
                user.first_name || session.userName,
            ]);
            logger.info(`MPIN change confirmation SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send MPIN change confirmation SMS: ${error}`);
    }

    res.status(OK).json({ message: 'MPIN reset successful' });
};

export {
    login,
    verifyMpin,
    resetPassword,
    forgotPasswordInitiate,
    resendForgotPasswordOtp,
    forgotOTPverify,
    forgotPasswordReset,
    forgotMpinInitiate,
    forgotMpinOtpVerify,
    resendForgotMpinOtp,
    forgotMpinReset,
    verify2FA,
    send2FALoginOtp,
};
