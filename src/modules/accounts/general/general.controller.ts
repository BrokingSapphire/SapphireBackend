// general.controller.ts
import { Response } from 'express';
import { Request } from '@app/types.d';
import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types.d';
import { OK } from '@app/utils/httpstatus';
import { SessionJwtType } from '@app/modules/common.types';
import { db } from '@app/database';
import { EmailOtpVerification, PhoneOtpVerification } from '@app/services/otp.service';
import { randomUUID } from 'crypto';
import redisClient from '@app/services/redis.service';
import { UnauthorizedError } from '@app/apiError';
import { DeleteAccountInitiateRequest, DeleteAccountVerifyRequest, KnowYourPartnerResponse, KnowYourPartnerType, NotificationSettings, TwoFactorDisableRequest, TwoFactorMethod, TwoFactorSetupRequest, TwoFactorSetupResponse, TwoFactorStatusResponse, TwoFactorVerifySetupRequest, UserOrderPreferences, UserPermissions, UserSettings } from './general.types';
import { SmsTemplateType } from '@app/services/sms-templates/sms.types';
import smsService from '@app/services/sms.service';
import { verifyPassword } from '@app/utils/passwords';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import logger from '@app/logger';

const getKnowYourPartner = async (
    req: Request<undefined, ParamsDictionary, KnowYourPartnerResponse, undefined>,
    res: Response<KnowYourPartnerResponse>,
) => {
    const partnerInfo: KnowYourPartnerType = {
        companyName: 'Sapphire Broking',
        supportContact: 9876543210,
        supportEmail: 'support@stocktradinghub.com',
        supportAddress: '-115-122, First Floor Malang Bazaar',
    };

    res.status(OK).json({
        message: 'Company support information retrieved successfully',
        data: partnerInfo,
    });
};

const updateOrderPreferences = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, UserOrderPreferences>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const preferences = req.body;

    await db
        .updateTable('user_preferences')
        .set({
            order_preferences: JSON.stringify(preferences),
            updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();

    res.status(OK).json({
        message: 'Order preferences updated successfully',
        data: preferences,
    });
};

const updateUserSettings = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, UserSettings>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const {
        theme,
        biometricAuthentication,
        chartProvider,
        orderNotifications,
        tradeNotifications,
        tradeRecommendations,
        promotion,
    } = req.body;

    await db
        .updateTable('user_preferences')
        .set({
            theme,
            biometric_authentication: biometricAuthentication,
            chart_provider: chartProvider,
            order_notifications: orderNotifications,
            trade_notifications: tradeNotifications,
            trade_recommendations: tradeRecommendations,
            promotion_notifications: promotion,
            updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();

    res.status(OK).json({
        message: 'User settings updated successfully',
        data: req.body,
    });
};

const updateUserPermissions = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, UserPermissions>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { internet, storage, location, smsReading, notification, biometric } = req.body;

    await db
        .updateTable('user_preferences')
        .set({
            internet_permission: internet,
            storage_permission: storage,
            location_permission: location,
            sms_reading_permission: smsReading,
            notification_permission: notification,
            biometric_permission: biometric,
            updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();

    res.status(OK).json({
        message: 'User permissions updated successfully',
        data: req.body,
    });
};

const updateNotificationSettings = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, NotificationSettings>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { orderNotifications, tradeNotifications, tradeRecommendations, promotion } = req.body;

    await db
        .updateTable('user_preferences')
        .set({
            order_notifications: orderNotifications,
            trade_notifications: tradeNotifications,
            trade_recommendations: tradeRecommendations,
            promotion_notifications: promotion,
            updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();

    res.status(OK).json({
        message: 'Notification settings updated successfully',
        data: req.body,
    });
};

const initiateAccountDeletion = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, DeleteAccountInitiateRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { reason } = req.body;

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .select(['user.id', 'user.email', 'user_name.first_name', 'phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    const sessionId = randomUUID();
    const deletionSession = {
        sessionId,
        userId: user.id,
        email: user.email,
        userName: user.first_name,
        phone: user.phone,
        reason: reason || null,
        isVerified: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
    };

    const redisKey = `delete_account:${sessionId}`;
    await redisClient.set(redisKey, JSON.stringify(deletionSession));
    await redisClient.expire(redisKey, 10 * 60);

    const emailOtp = new EmailOtpVerification(user.email, 'account-deletion');
    await emailOtp.sendOtp();
    
    // Mask email for response
    const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.status(OK).json({
        message: 'OTP sent to your registered email',
        data: {
            sessionId,
            maskedEmail,
        },
    });
};

const verifyAccountDeletionOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, DeleteAccountVerifyRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { otp, sessionId } = req.body;

    const redisKey = `delete_account:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Deletion session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid deletion session');
    }

    if (session.isUsed) {
        throw new UnauthorizedError('Deletion session already used');
    }

    const emailOtp = new EmailOtpVerification(session.email, 'account-deletion');
    await emailOtp.verifyOtp(otp);

    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    await db.transaction().execute(async (tx) => {
        if (session.reason) {
            await tx
                .insertInto('account_deletions')
                .values({
                    user_id: userId,
                    email: session.email,
                    deletion_reason: session.reason,
                })
                .execute();
        }
        await tx.deleteFrom('user').where('id', '=', userId).execute();
    });

    res.status(OK).json({
        message: 'Account deleted successfully',
        data: null,
    });
};

const resendAccountDeletionOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, { sessionId: string }>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId } = req.body;

    const redisKey = `delete_account:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Deletion session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid deletion session');
    }
    if (session.isUsed) {
        throw new UnauthorizedError('Deletion session already completed');
    }

    // Resend OTP to email
    const emailOtp = new EmailOtpVerification(session.email, 'account-deletion');
    await emailOtp.sendOtp();

    // Extend session expiry
    await redisClient.expire(redisKey, 10 * 60);

    res.status(OK).json({
        message: 'OTP resent successfully',
        data: {
            maskedEmail: session.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        },
    });
};

// Get current 2FA status
const get2FAStatus = async (
    req: Request<SessionJwtType, ParamsDictionary, TwoFactorStatusResponse, undefined>,
    res: Response<TwoFactorStatusResponse>,
) => {
    const { userId } = req.auth!;

    const user2FA = await db
        .selectFrom('user_2fa')
        .innerJoin('user', 'user_2fa.user_id', 'user.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user_2fa.method', 'phone_number.phone'])
        .where('user_2fa.user_id', '=', userId)
        .executeTakeFirst();

    const method = (user2FA?.method as TwoFactorMethod) || TwoFactorMethod.DISABLED;
    const enabled = method !== TwoFactorMethod.DISABLED;

    res.status(OK).json({
        message: '2FA status retrieved successfully',
        data: {
            method,
            enabled,
        },
    });
}
const setup2FA = async (
    req: Request<SessionJwtType, ParamsDictionary, TwoFactorSetupResponse, TwoFactorSetupRequest>,
    res: Response<TwoFactorSetupResponse>,
) => {
    const { userId } = req.auth!;
    const { method } = req.body;

    // Check if 2FA is already enabled
    const existing2FA = await db
        .selectFrom('user_2fa')
        .select(['method', 'secret'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    if (existing2FA) {
        throw new UnauthorizedError('2FA is already enabled for this account. Disable it first to change method.');
    }

    // Get user details
    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.id', 'user.email', 'phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    const sessionId = randomUUID();

    if (method === TwoFactorMethod.SMS_OTP) {
        // Setup SMS OTP
        const phoneNumber = String(user.phone);
        if (!phoneNumber) {
            throw new UnauthorizedError('Phone number is required for SMS 2FA');
        }

        // Send SMS OTP for verification
        const smsOtp = new PhoneOtpVerification(user.email, '2fa-setup', phoneNumber)
        await smsOtp.sendOtp();

        const otpKey = `phone-otp:2fa-setup:${user.email}`;
const otp = await redisClient.get(otpKey);

try {
    if (otp) {
        await smsService.sendTemplatedSms(phoneNumber, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [
            String(otp)
        ]);
    }
} catch (error) {
    logger.error(`Failed to send SMS: ${error}`);
}

        // Store temporary setup session
        const setupSession = {
            sessionId,
            userId,
            method: TwoFactorMethod.SMS_OTP,
            phoneNumber,
            verified: false,
            createdAt: new Date().toISOString(),
        };

        const tempKey = `2fa_setup:${sessionId}`;
        await redisClient.set(tempKey, JSON.stringify(setupSession));
        await redisClient.expire(tempKey, 10 * 60);

        res.status(OK).json({
            message: 'SMS OTP sent for 2FA setup verification',
            data: {
                method: TwoFactorMethod.SMS_OTP,
                maskedPhone: phoneNumber.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3'),
                sessionId,
            },
        });

    } else if (method === TwoFactorMethod.AUTHENTICATOR) {
        // Setup Authenticator
        const secret = speakeasy.generateSecret({
            name: `Sapphire (${user.email})`,
            issuer: 'Sapphire Trading',
            length: 32,
        });

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

        // Store temporary setup session
        const setupSession = {
            sessionId,
            userId,
            method: TwoFactorMethod.AUTHENTICATOR,
            secret: secret.base32,
            verified: false,
            createdAt: new Date().toISOString(),
        };

        const tempKey = `2fa_setup:${sessionId}`;
        await redisClient.set(tempKey, JSON.stringify(setupSession));
        await redisClient.expire(tempKey, 10 * 60);

        res.status(OK).json({
            message: '2FA setup initiated. Please verify with your authenticator app.',
            data: {
                method: TwoFactorMethod.AUTHENTICATOR,
                secret: secret.base32,
                qrCodeUrl,
                manualEntryKey: secret.base32,
                sessionId,
            },
        });
    } else {
        throw new UnauthorizedError('Invalid 2FA method');
    }
};

const verify2FASetup = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, TwoFactorVerifySetupRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { token, sessionId, method } = req.body;

    const tempKey = `2fa_setup:${sessionId}`;
    const sessionStr = await redisClient.get(tempKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Setup session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.userId !== userId || session.method !== method) {
        throw new UnauthorizedError('Invalid setup session');
    }

    if (session.verified) {
        throw new UnauthorizedError('Setup session already completed');
    }

    let verified = false;

    if (method === TwoFactorMethod.SMS_OTP) {
        const user = await db
            .selectFrom('user')
            .select(['email'])
            .where('id', '=', userId)
            .executeTakeFirstOrThrow();

        const phoneStr = String(session.phoneNumber);
        const smsOtp = new PhoneOtpVerification(user.email, '2fa-setup', phoneStr);
        try {
            await smsOtp.verifyOtp(token);
            verified = true;
        } catch (error) {
            throw new UnauthorizedError('Invalid SMS OTP');
        }
    } else if (method === TwoFactorMethod.AUTHENTICATOR) {
        verified = speakeasy.totp.verify({
            secret: session.secret,
            encoding: 'base32',
            token,
            window: 2,
        });

        if (!verified) {
            throw new UnauthorizedError('Invalid authenticator token');
        }
    }

    if (!verified) {
        throw new UnauthorizedError('Invalid 2FA token');
    }

    // Save 2FA configuration to database
    await db.transaction().execute(async (tx) => {
        await tx
            .insertInto('user_2fa')
            .values({
                user_id: userId,
                method,
                secret: method === TwoFactorMethod.AUTHENTICATOR ? session.secret : null,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .execute();
    });

    // Mark session as verified and clean up
    await redisClient.del(tempKey);

    logger.info(`2FA ${method} enabled for user ${userId}`);

    res.status(OK).json({
        message: '2FA has been successfully enabled for your account',
        data: { method },
    });
};

const disable2FA = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, TwoFactorDisableRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { password, token } = req.body;

    // Verify user password
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user.id',
            'user.email',
            'hashing_algorithm.name as hashAlgo',
            'user_password_details.password_salt as salt',
            'user_password_details.password_hash as hashedPassword',
        ])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    const authenticated = await verifyPassword(password, user);
    if (!authenticated) {
        throw new UnauthorizedError('Invalid password');
    }

    // Get user's 2FA configuration
    const user2FA = await db
        .selectFrom('user_2fa')
        .innerJoin('user', 'user_2fa.user_id', 'user.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user_2fa.method', 'user_2fa.secret', 'phone_number.phone'])
        .where('user_2fa.user_id', '=', userId)
        .executeTakeFirst();

    if (!user2FA) {
        throw new UnauthorizedError('2FA is not enabled for this account');
    }

    // Verify the token based on method
    let verified = false;

    if (user2FA.method === TwoFactorMethod.SMS_OTP) {
        const phoneStr = String(user2FA.phone);
        const smsOtp = new PhoneOtpVerification(user.email, '2fa-disable', phoneStr);
        try {
            await smsOtp.verifyOtp(token);
            verified = true;
        } catch (error) {
            throw new UnauthorizedError('Invalid SMS OTP');
        }
    } else if (user2FA.method === TwoFactorMethod.AUTHENTICATOR) {
        verified = speakeasy.totp.verify({
            secret: user2FA.secret!,
            encoding: 'base32',
            token,
            window: 2,
        });

        if (!verified) {
            throw new UnauthorizedError('Invalid authenticator token');
        }
    }

    if (!verified) {
        throw new UnauthorizedError('Invalid 2FA token');
    }

    // Disable 2FA
    await db.transaction().execute(async (tx) => {
        await tx.deleteFrom('user_2fa').where('user_id', '=', userId).execute();
    });

    logger.info(`2FA disabled for user ${userId}`);

    res.status(OK).json({
        message: '2FA has been successfully disabled for your account',
        data: null,
    });
};
const send2FADisableOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;

    // Get user's 2FA configuration
    const user2FA = await db
        .selectFrom('user_2fa')
        .innerJoin('user', 'user_2fa.user_id', 'user.id')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user_2fa.method', 'phone_number.phone', 'user.email'])
        .where('user_2fa.user_id', '=', userId)
        .executeTakeFirst();

    if (!user2FA) {
        throw new UnauthorizedError('2FA is not enabled for this account');
    }

    if (user2FA.method !== TwoFactorMethod.SMS_OTP) {
        throw new UnauthorizedError('SMS OTP is not enabled for this account');
    }

    const phoneStr = String(user2FA.phone);

    // Send SMS OTP for disable verification
    const smsOtp = new PhoneOtpVerification(user2FA.email, '2fa-disable', phoneStr);
    await smsOtp.sendOtp();

    const otpKey = `phone-otp:2fa-disable:${user2FA.email}`;
    const otp = await redisClient.get(otpKey);

    try {
        if (otp) {
            await smsService.sendTemplatedSms(phoneStr, SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP, [
                String(otp)
            ]);
            logger.info(`2FA disable OTP SMS sent to ${phoneStr}`);
        }
    } catch (error) {
        logger.error(`Failed to send 2FA disable OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent for 2FA disable verification',
        data: {
            maskedPhone: user2FA.phone.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3'),
        },
    });
};


export {
    getKnowYourPartner,
    updateOrderPreferences,
    updateUserSettings,
    updateUserPermissions,
    updateNotificationSettings,
    initiateAccountDeletion,
    verifyAccountDeletionOtp,
    resendAccountDeletionOtp,
    get2FAStatus,
    setup2FA,
    verify2FASetup,
    disable2FA,
    send2FADisableOtp,
};