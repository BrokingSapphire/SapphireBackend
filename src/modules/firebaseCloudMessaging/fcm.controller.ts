import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import { BadRequestError, InternalServerError, NotFoundError } from '@app/apiError';
import { db } from '@app/database';
import { OK, CREATED } from '@app/utils/httpstatus';
import fcmService from '@app/services/fcm.services';
import logger from '@app/logger';
import {
    DeleteFcmTokenType,
    SaveFcmTokenType,
    SendBulkNotificationType,
    SendNotificationToUserType,
    SendTopicNotificationType,
} from './fcm.types';

/**
 * Save FCM token for user
 */

export const saveFcmToken = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, SaveFcmTokenType>,
    res: Response,
) => {
    try {
        const { clientId, fcmToken } = req.body;

        // Validation
        if (!clientId || !fcmToken) {
            throw new BadRequestError('Missing required fields: clientId and fcmToken');
        }

        // Validate FCM token format
        if (!fcmService.isValidToken(fcmToken)) {
            throw new BadRequestError('Invalid FCM token format');
        }

        await db.transaction().execute(async (tx) => {
            // Check if user exists
            const userExists = await tx.selectFrom('user').select('id').where('id', '=', clientId).executeTakeFirst();

            if (!userExists) {
                throw new BadRequestError('User not found');
            }

            // Deactivate old tokens for this user
            await tx
                .updateTable('user_fcm_tokens')
                .set({
                    is_active: false,
                    updated_at: new Date(),
                })
                .where('user_id', '=', clientId)
                .execute();

            // Insert new FCM token
            await tx
                .insertInto('user_fcm_tokens')
                .values({
                    user_id: clientId,
                    fcm_token: fcmToken,
                    is_active: true,
                })
                .onConflict((oc) =>
                    oc.constraint('uq_user_fcm_token').doUpdateSet((eb) => ({
                        is_active: true,
                        updated_at: new Date(),
                    })),
                )
                .execute();
        });

        logger.info(`FCM token updated for user: ${clientId}`);

        res.status(CREATED).json({
            message: 'FCM token saved successfully',
        });
    } catch (error: any) {
        logger.error('Error saving FCM token:', error.message);
        throw error;
    }
};

/**
 * Delete FCM token for user
 */
export const deleteFcmToken = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, DeleteFcmTokenType>,
    res: Response,
) => {
    try {
        const { clientId, fcmToken } = req.body;

        if (!clientId || !fcmToken) {
            throw new BadRequestError('Missing required fields: clientId and fcmToken');
        }

        const result = await db
            .updateTable('user_fcm_tokens')
            .set({
                is_active: false,
                updated_at: new Date(),
            })
            .where('user_id', '=', clientId)
            .where('fcm_token', '=', fcmToken)
            .executeTakeFirst();

        if (Number(result.numUpdatedRows) === 0) {
            throw new NotFoundError('FCM token not found');
        }

        logger.info(`FCM token deactivated for user: ${clientId}`);

        res.status(OK).json({
            message: 'FCM token deleted successfully',
        });
    } catch (error: any) {
        logger.error('Error deleting FCM token:', error.message);
        throw error;
    }
};

/**
 * Send notification to a specific user
 */
export const sendNotificationToUser = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, SendNotificationToUserType>,
    res: Response,
) => {
    try {
        const { userId, title, body, data, options } = req.body;

        if (!userId || !title || !body) {
            throw new BadRequestError('Missing required fields: userId, title, body');
        }

        // Get user's active FCM tokens
        const userTokens = await db
            .selectFrom('user_fcm_tokens')
            .select('fcm_token')
            .where('user_id', '=', userId)
            .where('is_active', '=', true)
            .execute();

        if (userTokens.length === 0) {
            throw new NotFoundError('No active FCM tokens found for user');
        }

        const tokens = userTokens.map((row) => row.fcm_token);
        const results = await fcmService.sendBatchNotification(tokens, title, body, data, options);

        logger.info(
            `Notification sent to user ${userId}: ${results.success.length} successful, ${results.failed.length} failed`,
        );

        res.status(OK).json({
            message: `Sent to ${results.success.length} devices, ${results.failed.length} failed`,
        });
    } catch (error: any) {
        logger.error('Error sending notification to user:', error.message);
        throw error;
    }
};

/**
 * Send bulk notifications to multiple users
 */
export const sendBulkNotification = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, SendBulkNotificationType>,
    res: Response,
) => {
    try {
        const { userIds, title, body, data, options } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
            throw new BadRequestError('Missing required fields: userIds (array), title, body');
        }

        // Get all active FCM tokens for the specified users
        const userTokens = await db
            .selectFrom('user_fcm_tokens')
            .select('fcm_token')
            .where('user_id', 'in', userIds)
            .where('is_active', '=', true)
            .execute();

        if (userTokens.length === 0) {
            throw new NotFoundError('No active FCM tokens found for specified users');
        }

        const tokens = userTokens.map((row) => row.fcm_token);
        const results = await fcmService.sendBatchNotification(tokens, title, body, data, options);

        logger.info(
            `Bulk notification sent to ${userIds.length} users: ${results.success.length} successful, ${results.failed.length} failed`,
        );

        res.status(OK).json({
            message: `Sent to ${results.success.length} users, ${results.failed.length} failed`,
        });
    } catch (error: any) {
        logger.error('Error sending bulk notification:', error.message);
        throw error;
    }
};

/**
 * Send topic notification
 */
export const sendTopicNotification = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, SendTopicNotificationType>,
    res: Response,
) => {
    try {
        const { topic, title, body, data, options } = req.body;

        if (!topic || !title || !body) {
            throw new BadRequestError('Missing required fields: topic, title, body');
        }

        const result = await fcmService.sendTopicNotification(topic, title, body, data, options);

        logger.info(`Topic notification sent to topic: ${topic}`);

        res.status(OK).json({
            message: 'Topic notification sent successfully',
        });
    } catch (error: any) {
        logger.error('Error sending topic notification:', error.message);
        throw error;
    }
};
