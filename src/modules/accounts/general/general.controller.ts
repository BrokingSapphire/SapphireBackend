// general.controller.ts
import { Response } from 'express';
import { Request } from '@app/types.d';
import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types.d';
import { OK } from '@app/utils/httpstatus';
import { SessionJwtType } from '@app/modules/common.types';
import { db } from '@app/database';
import { EmailOtpVerification } from '@app/services/otp.service';
import { randomUUID } from 'crypto';
import redisClient from '@app/services/redis.service';
import { UnauthorizedError } from '@app/apiError';
import { DeleteAccountInitiateRequest, DeleteAccountVerifyRequest, KnowYourPartnerResponse, KnowYourPartnerType, NotificationSettings, UserOrderPreferences, UserPermissions, UserSettings } from './general.types';

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

export {
    getKnowYourPartner,
    updateOrderPreferences,
    updateUserSettings,
    updateUserPermissions,
    updateNotificationSettings,
    initiateAccountDeletion,
    verifyAccountDeletionOtp,
    resendAccountDeletionOtp,
};