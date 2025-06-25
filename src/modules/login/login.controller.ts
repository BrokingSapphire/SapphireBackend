import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '@app/services/otp.service';
import { randomUUID } from 'crypto';
import { UnauthorizedError, BadRequestError } from '@app/apiError';
import { db } from '@app/database';
import { insertCredentialDetails } from '@app/database/transactions';
import { sign } from '@app/utils/jwt';
import { OK, CREATED } from '@app/utils/httpstatus';
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
    CreateMpinRequestType,
} from './login.types';
import { TwoFactorMethod } from '../account/general/general.types';
import { ResponseWithToken, SessionJwtType } from '@app/modules/common.types';
import { hashPassword, verifyPassword } from '@app/utils/passwords';
import { PhoneOtpVerification } from '@app/services/otp.service';
import deviceTrackingService from '@app/services/deviceip.service';
import {
    sendPasswordChangeConfirmation,
    sendLoginAlert,
    sendMpinChangeConfirmation,
} from '@app/services/notification.service';
import { SmsTemplateType } from '@app/services/notifications-types/sms.types';
import smsService from '@app/services/sms.service';
import logger from '@app/logger';

const formatName = (name: string): string => {
    if (!name) return '';
    return name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response,
) => {
    const { password } = req.body;
    const clientId = 'clientId' in req.body ? req.body.clientId : undefined;
    const email = 'email' in req.body ? req.body.email : undefined;

    if (!password) {
        throw new BadRequestError('Password is required');
    }

    if (!clientId && !email) {
        throw new BadRequestError('Either clientId or email is required');
    }

    const deviceInfo = await deviceTrackingService.getDeviceInfo(req);

    logger.info(
        `Login attempt initiated - IP: ${deviceInfo.ip} | User: ${clientId || email} | UA: ${req.get('User-Agent')}`,
        {
            requestId: randomUUID(),
            loginIdentifier: clientId || email,
            loginType: clientId ? 'clientId' : 'email',
            requestIp: deviceInfo.ip,
            forwardedFor: req.get('X-Forwarded-For'),
            realIp: req.get('X-Real-IP'),
            userAgent: req.get('User-Agent'),
            browser: deviceInfo.device?.browser,
            device: deviceInfo.device?.device,
            deviceType: deviceInfo.device?.deviceType,
            location: deviceInfo.location,
            timestamp: new Date().toISOString(),
            headers: {
                host: req.get('Host'),
                origin: req.get('Origin'),
                referer: req.get('Referer'),
            },
        },
    );

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
            if (clientId) {
                return qb.where('user.id', '=', clientId);
            } else if (email) {
                return qb.where('user.email', '=', email);
            }
            return qb;
        })
        .executeTakeFirst();

    // Check if user exists
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    if (clientId && user.id !== clientId) {
        throw new UnauthorizedError('Invalid credentials');
    }

    const authenticated = await verifyPassword(password, user);

    if (!authenticated) {
        logger.warn(`LOGIN FAILED - Invalid password for user ${user.email} from IP ${deviceInfo.ip}`, {
            userId: user.id,
            userEmail: user.email,
            requestIp: deviceInfo.ip,
            deviceInfoIp: deviceInfo.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
        });

        await db
            .insertInto('user_login_history')
            .values({
                user_id: user.id,
                email: user.email,
                ip_address: deviceInfo.ip,
                user_agent: deviceInfo.device.userAgent,
                browser: deviceInfo.device.browser || null,
                device: deviceInfo.device.device || null,
                device_type: deviceInfo.device.deviceType || null,
                location_country: deviceInfo.location.country || null,
                location_region: deviceInfo.location.region || null,
                location_city: deviceInfo.location.city || null,
                success: false,
                failure_reason: 'Invalid password',
                session_id: null,
            })
            .execute();
        throw new UnauthorizedError('Invalid credentials');
    }

    logger.info('Password verification successful', {
        userId: user.id,
        userEmail: user.email,
        requestIp: deviceInfo.ip,
        timestamp: new Date().toISOString(),
    });

    // Rest of your existing code remains the same...
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
        userName: formatName(user.first_name),
        clientId: clientId || undefined,
        passwordVerified: true,
        twoFactorVerified: false,
        mpinVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
        deviceInfo: {
            ip: deviceInfo.ip,
            location: deviceInfo.location,
            device: deviceInfo.device,
            timestamp: deviceInfo.timestamp,
        },
    };

    logger.info('Login session created', {
        sessionId: loginSessionId,
        userId: user.id,
        userEmail: user.email,
        requestIp: deviceInfo.ip,
        has2FA: !!user2FA && user2FA.method !== 'disabled',
        twoFactorMethod: user2FA?.method || 'disabled',
        timestamp: new Date().toISOString(),
    });

    const redisKey = `login_session:${loginSessionId}`;
    await redisClient.set(redisKey, JSON.stringify(loginSession));
    await redisClient.expire(redisKey, 10 * 60);

    const deviceLocationInfo = {
        ip: deviceInfo.ip,
        location: {
            country: deviceInfo.location.country || 'Unknown',
            region: deviceInfo.location.region || 'Unknown',
            city: deviceInfo.location.city || 'Unknown',
            formatted: deviceTrackingService.formatLocationString(deviceInfo.location),
        },
        device: {
            browser: deviceInfo.device.browser || 'Unknown Browser',
            device: deviceInfo.device.device || 'Unknown Device',
            deviceType: deviceInfo.device.deviceType || 'desktop',
            formatted: deviceTrackingService.formatDeviceString(deviceInfo.device),
            userAgent: deviceInfo.device.userAgent,
        },
        timestamp: deviceInfo.timestamp,
    };

    if (user2FA && user2FA.method !== 'disabled') {
        const method = user2FA.method as TwoFactorMethod;

        logger.info('2FA required for login', {
            sessionId: loginSessionId,
            userId: user.id,
            userEmail: user.email,
            twoFactorMethod: method,
            requestIp: deviceInfo.ip,
            timestamp: new Date().toISOString(),
        });

        if (method === TwoFactorMethod.SMS_OTP) {
            const phoneStr = String(user.phone);

            const smsOtp = new PhoneOtpVerification(user.email, '2fa-login', phoneStr);
            await smsOtp.sendOtp();

            const otpKey = `otp:phone-otp:2fa-login:${user.email}:${user.phone}`;
            const otp = await redisClient.get(otpKey);

            try {
                if (otp) {
                    await smsService.sendTemplatedSms(phoneStr, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [otp]);
                    logger.info('2FA SMS OTP sent successfully', {
                        sessionId: loginSessionId,
                        userId: user.id,
                        phoneNumber: phoneStr,
                        requestIp: deviceInfo.ip,
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (error) {
                logger.error('Failed to send 2FA OTP SMS', {
                    sessionId: loginSessionId,
                    userId: user.id,
                    phoneNumber: phoneStr,
                    requestIp: deviceInfo.ip,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    timestamp: new Date().toISOString(),
                });
            }

            res.status(OK).json({
                message: 'Password verified. SMS OTP sent for 2FA verification.',
                data: {
                    sessionId: loginSessionId,
                    nextStep: '2fa',
                    twoFactorMethod: method,
                    firstName: formatName(user.first_name),
                    maskedPhone: phoneStr.replace(/(\d{6})(\d{4})/, '******$2'),
                    deviceInfo: deviceLocationInfo,
                },
            });
        } else {
            logger.info('2FA authenticator method initiated', {
                sessionId: loginSessionId,
                userId: user.id,
                userEmail: user.email,
                requestIp: deviceInfo.ip,
                timestamp: new Date().toISOString(),
            });

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
                    firstName: formatName(user.first_name),
                    qrCodeUrl,
                    manualEntryKey: user2FADetails?.secret,
                    deviceInfo: deviceLocationInfo,
                },
            });
        }
        return;
    }

    const userMpin = await db
        .selectFrom('user_mpin')
        .innerJoin('hashing_algorithm', 'user_mpin.hash_algo_id', 'hashing_algorithm.id')
        .select(['user_mpin.is_active', 'user_mpin.failed_attempts', 'hashing_algorithm.name as hashAlgo'])
        .where('user_mpin.client_id', '=', user.id)
        .executeTakeFirst();

    if (!userMpin || !userMpin.is_active) {
        logger.info('MPIN not set for user', {
            sessionId: loginSessionId,
            userId: user.id,
            userEmail: user.email,
            requestIp: deviceInfo.ip,
            timestamp: new Date().toISOString(),
        });

        res.status(OK).json({
            message: 'Password verified. Please set your MPIN.',
            data: {
                sessionId: loginSessionId,
                nextStep: 'set-mpin',
                firstName: formatName(user.first_name),
                deviceInfo: deviceLocationInfo,
            },
        });
        return;
    }

    logger.info('No 2FA required, proceeding to MPIN verification', {
        sessionId: loginSessionId,
        userId: user.id,
        userEmail: user.email,
        requestIp: deviceInfo.ip,
        timestamp: new Date().toISOString(),
    });

    res.status(OK).json({
        message: 'Password verified. Please enter your MPIN.',
        data: {
            sessionId: loginSessionId,
            nextStep: 'mpin',
            firstName: formatName(user.first_name),
            deviceInfo: deviceLocationInfo,
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
    const deviceInfo = await deviceTrackingService.getDeviceInfo(req);

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
            await db
                .insertInto('user_login_history')
                .values({
                    user_id: session.userId,
                    email: session.email,
                    ip_address: deviceInfo.ip,
                    user_agent: deviceInfo.device.userAgent,
                    browser: deviceInfo.device.browser || null,
                    device: deviceInfo.device.device || null,
                    device_type: deviceInfo.device.deviceType || null,
                    location_country: deviceInfo.location.country || null,
                    location_region: deviceInfo.location.region || null,
                    location_city: deviceInfo.location.city || null,
                    success: false,
                    failure_reason: 'Invalid authenticator token',
                    session_id: sessionId,
                })
                .execute();
            throw new UnauthorizedError('Invalid authenticator token');
        }
    } else {
        throw new UnauthorizedError('Invalid 2FA method');
    }

    if (!verified) {
        throw new UnauthorizedError('Invalid 2FA token');
    }

    const userInfo = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user_name.first_name'])
        .where('user.id', '=', session.userId)
        .executeTakeFirstOrThrow();

    session.twoFactorVerified = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    res.status(OK).json({
        message: '2FA verified. Please enter your MPIN.',
        data: {
            sessionId,
            nextStep: 'mpin',
            firstName: formatName(userInfo.first_name),
        },
    });
    await db
        .insertInto('user_login_history')
        .values({
            user_id: session.userId,
            email: session.email,
            ip_address: deviceInfo.ip,
            user_agent: deviceInfo.device.userAgent,
            browser: deviceInfo.device.browser || null,
            device: deviceInfo.device.device || null,
            device_type: deviceInfo.device.deviceType || null,
            location_country: deviceInfo.location.country || null,
            location_region: deviceInfo.location.region || null,
            location_city: deviceInfo.location.city || null,
            success: true,
            failure_reason: null,
            session_id: sessionId,
        })
        .execute();
};

const Resend2FALoginOtp = async (
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

    const otpKey = `otp:phone-otp:2fa-login:${user2FA.email}:${user2FA.phone}`;
    const existingOtp = await redisClient.get(otpKey);

    if (!existingOtp) {
        throw new BadRequestError('No active OTP session found. Please request a new OTP.');
    }

    // Send SMS OTP
    const smsOtp = new PhoneOtpVerification(user2FA.email, '2fa-login' as any, user2FA.phone);
    await smsOtp.resendExistingOtp();

    try {
        await smsService.sendTemplatedSms(user2FA.phone, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [existingOtp]);
        logger.info(`2FA OTP SMS resent to ${user2FA.phone} - using existing OTP`);
    } catch (error) {
        logger.error(`Failed to resend 2FA OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent for 2FA verification',
        data: {
            maskedPhone: user2FA.phone.replace(/(\d{6})(\d{4})/, '******$2'),
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
    const deviceInfo = await deviceTrackingService.getDeviceInfo(req);

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

        await db
            .insertInto('user_login_history')
            .values({
                user_id: userId,
                email: session.email,
                ip_address: deviceInfo.ip,
                user_agent: deviceInfo.device.userAgent,
                browser: deviceInfo.device.browser || null,
                device: deviceInfo.device.device || null,
                device_type: deviceInfo.device.deviceType || null,
                location_country: deviceInfo.location.country || null,
                location_region: deviceInfo.location.region || null,
                location_city: deviceInfo.location.city || null,
                success: false,
                failure_reason: 'Invalid MPIN',
                session_id: sessionId,
            })
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

    await db
        .insertInto('user_login_history')
        .values({
            user_id: userId,
            email: session.email,
            ip_address: deviceInfo.ip,
            user_agent: deviceInfo.device.userAgent,
            browser: deviceInfo.device.browser || null,
            device: deviceInfo.device.device || null,
            device_type: deviceInfo.device.deviceType || null,
            location_country: deviceInfo.location.country || null,
            location_region: deviceInfo.location.region || null,
            location_city: deviceInfo.location.city || null,
            success: true,
            failure_reason: null,
            session_id: sessionId,
        })
        .execute();

    const formattedUserName = formatName(session.userName);
    await sendLoginAlert(session.email, {
        userName: formattedUserName,
        email: session.email,
        ip: req.ip || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location',
    });

    res.status(OK).json({
        message: 'Login successful',
        token,
        firstName: session.userName,
    } as any);
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
        await insertCredentialDetails(tx, userId, hashedPassword, 'password');
    });

    // Send password change confirmation email using notification service
    await sendPasswordChangeConfirmation(user.email, {
        userName: user.first_name,
        email: user.email,
        ip: req.ip || req.socket.remoteAddress || 'N/A',
        deviceType: req.get('User-Agent') || 'Unknown Device',
        location: 'Unknown Location', // You can add geolocation if needed
    });

    try {
        if (user.phone) {
            const formattedName = formatName(user.first_name);
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION, [
                formattedName,
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

    const otpKey = `otp:email-otp:forgot-password:${user.email}`;
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

    const emailOtpInstance = new EmailOtpVerification(session.email, 'forgot-password');
    await emailOtpInstance.verifyOtp(otp);

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

    const emailOtpKey = `otp:email-otp:forgot-password:${session.email}`;
    const existingOtp = await redisClient.get(emailOtpKey);

    if (!existingOtp) {
        throw new BadRequestError('No active OTP session found. Please request a new OTP.');
    }

    const emailOtp = new EmailOtpVerification(session.email, 'forgot-password');
    await emailOtp.resendExistingOtp();

    const currentOtp = await redisClient.get(emailOtpKey);

    try {
        if (user && user.phone && currentOtp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.TERMINAL_PWD_RESET_OTP, [currentOtp]);
            logger.info(`Password reset OTP SMS resent to ${user.phone} - OTP: ${currentOtp}`);
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
        await insertCredentialDetails(tx, session.userId, hashed, 'password');
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
            const formattedName = formatName(user.first_name || session.userName);
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION, [
                formattedName,
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

    const otpKey = `otp:email-otp:forgot-mpin:${user.email}`;
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
    const { requestId, otp } = req.body;
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
    await emailOtpInstance.verifyOtp(otp);

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

    const emailOtpKey = `otp:email-otp:forgot-mpin:${session.email}`;
    const existingEmailOtp = await redisClient.get(emailOtpKey);

    if (!existingEmailOtp) {
        throw new BadRequestError('No active OTP session found. Please request a new OTP.');
    }

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['phone_number.phone'])
        .where('user.id', '=', session.userId)
        .executeTakeFirst();

    const emailOtp = new EmailOtpVerification(session.email, 'forgot-mpin');
    await emailOtp.resendExistingOtp();

    try {
        if (user && user.phone && existingEmailOtp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.FORGET_MPIN, [existingEmailOtp]);
            logger.info(`MPIN reset OTP SMS resent to ${user.phone} - using existing OTP`);
        }
    } catch (error) {
        logger.error(`Failed to resend MPIN reset OTP SMS: ${error}`);
    }

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

    await db.transaction().execute(async (tx) => {
        await insertCredentialDetails(tx, session.userId, hashedMpin, 'mpin');
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
            const formattedName = formatName(user.first_name || session.userName);
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.MPIN_CHANGE_CONFIRMATION, [formattedName]);
            logger.info(`MPIN change confirmation SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send MPIN change confirmation SMS: ${error}`);
    }

    res.status(OK).json({ message: 'MPIN reset successful' });
};

const setupMpin = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, CreateMpinRequestType>,
    res: Response,
) => {
    const { sessionId, mpin, confirm_mpin } = req.body;

    if (mpin !== confirm_mpin) {
        throw new BadRequestError('MPINs do not match');
    }

    const redisKey = `login_session:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);
    if (!sessionStr) {
        throw new UnauthorizedError('Login session expired or invalid');
    }

    const session = JSON.parse(sessionStr);
    const clientId = session.userId;

    const userInfo = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user_name.first_name'])
        .where('user.id', '=', clientId)
        .executeTakeFirstOrThrow();

    // Check if MPIN already exists
    const existingMpin = await db
        .selectFrom('user_mpin')
        .select('id')
        .where('client_id', '=', clientId)
        .executeTakeFirst();

    if (existingMpin) {
        throw new BadRequestError('MPIN already exists for this user');
    }

    // Check if user exists and get user info
    const user = await db.selectFrom('user').select(['id', 'email']).where('id', '=', clientId).executeTakeFirst();

    if (!user) {
        throw new UnauthorizedError('User not found');
    }

    const hashedMpin = await hashPassword(mpin, 'bcrypt');

    await db.transaction().execute(async (tx) => {
        await insertCredentialDetails(tx, clientId, hashedMpin, 'mpin');
    });

    res.status(CREATED).json({
        message: 'MPIN set successfully',
        firstName: formatName(userInfo.first_name),
    } as any);
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
    Resend2FALoginOtp,
    setupMpin,
};
