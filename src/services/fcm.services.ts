import { env } from '@app/env';
import axios from 'axios';
import { InternalServerError } from '@app/apiError';
import logger from '@app/logger';

/**
 * Service for handling Firebase Cloud Messaging (FCM) push notifications
 */

export class FcmService {
    private readonly projectId: string;
    private readonly clientEmail: string;
    private readonly privateKey: string;

    private accessToken: string | null = null;
    private tokenExpiryTime: number = 0;

    constructor() {
        this.projectId = env.firebase.projectId;
        this.clientEmail = env.firebase.clientEmail;
        this.privateKey = env.firebase.privateKey;

        logger.info(`FCM Service initialized for project: ${this.projectId}`);

        if (!this.projectId || !this.clientEmail || !this.privateKey) {
            logger.warn('FCM configuration incomplete - some environment variables missing');
        }
    }

    /**
     * Get OAuth2 access token for FCM API
     */
    private async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiryTime - 300000) {
            return this.accessToken;
        }
        try {
            const { GoogleAuth } = require('google-auth-library');

            const serviceAccount = {
                type: 'service_account',
                project_id: this.projectId,
                client_email: this.clientEmail,
                private_key: this.privateKey.replace(/\\n/g, '\n'),
            };

            const auth = new GoogleAuth({
                credentials: serviceAccount,
                scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
            });
            const client = await auth.getClient();
            const tokenResponse = await client.getAccessToken();

            if (!tokenResponse.token) {
                throw new Error('Failed to obtain access token');
            }

            this.accessToken = tokenResponse.token;
            this.tokenExpiryTime = Date.now() + 3600000;

            logger.debug('FCM access token obtained successfully');
            return this.accessToken!;
        } catch (error: any) {
            logger.error('Failed to obtain FCM access token:', error.message);
            throw new InternalServerError('Failed to authenticate with FCM service');
        }
    }
    /**
     * Send push notification to a specific device token
     */
    public async sendNotification(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
        options?: {
            imageUrl?: string;
            clickAction?: string;
            badge?: string;
        },
    ) {
        if (!token || typeof token !== 'string') {
            logger.error('Invalid FCM token provided');
            throw new InternalServerError('Invalid device token');
        }
        try {
            const accessToken = await this.getAccessToken();
            const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

            const message: any = {
                message: {
                    token,
                    notification: {
                        title,
                        body,
                    },
                    android: {
                        notification: {
                            title,
                            body,
                            click_action: options?.clickAction,
                            ...(options?.imageUrl && { image: options.imageUrl }),
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title,
                                    body,
                                },
                                badge: options?.badge ? parseInt(options.badge, 10) : undefined,
                            },
                        },
                        ...(options?.imageUrl && {
                            fcm_options: {
                                image: options.imageUrl,
                            },
                        }),
                    },
                    webpush: {
                        notification: {
                            title,
                            body,
                            icon: '/icon-192x192.png', // Default app icon
                            ...(options?.imageUrl && { image: options.imageUrl }),
                        },
                        fcm_options: {
                            link: options?.clickAction || '/',
                        },
                    },
                },
            };

            // Add custom data if provided
            if (data && Object.keys(data).length > 0) {
                message.message.data = data;
            }

            logger.debug(`Sending FCM notification to token: ${token.substring(0, 20)}...`);

            const response = await axios.post(fcmEndpoint, message, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000, // 10 second timeout
            });

            logger.info(`FCM notification sent successfully to token: ${token.substring(0, 20)}...`, {
                messageId: response.data.name,
            });

            return {
                success: true,
                messageId: response.data.name,
            };
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                logger.error(`FCM API timeout for token: ${token.substring(0, 20)}...`);
                throw new InternalServerError('Push notification service timeout');
            } else if (error.response) {
                const errorData = error.response.data;
                logger.error(`FCM API error for token: ${token.substring(0, 20)}...`, {
                    status: error.response.status,
                    error: errorData,
                });

                // Handle specific FCM errors
                if (errorData?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
                    logger.warn(`FCM token is invalid/unregistered: ${token.substring(0, 20)}...`);
                    throw new InternalServerError('Device token is invalid or expired');
                }

                throw new InternalServerError(`Push notification service error: ${error.response.status}`);
            } else {
                logger.error(`FCM API network error for token: ${token.substring(0, 20)}...`, error.message);
                throw new InternalServerError('Push notification service unavailable');
            }
        }
    }
    /**
     * Send notifications to multiple tokens (batch)
     */
    public async sendBatchNotification(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
        options?: {
            imageUrl?: string;
            clickAction?: string;
            badge?: string;
        },
    ) {
        if (!tokens || tokens.length === 0) {
            logger.warn('No tokens provided for batch notification');
            return { success: [], failed: [] };
        }

        const results = {
            success: [] as string[],
            failed: [] as { token: string; error: string }[],
        };

        // Process in batches of 500 (FCM limit)
        const batchSize = 500;
        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);

            const promises = batch.map(async (token) => {
                try {
                    await this.sendNotification(token, title, body, data, options);
                    results.success.push(token);
                } catch (error: any) {
                    results.failed.push({
                        token: token.substring(0, 20) + '...',
                        error: error.message,
                    });
                }
            });

            await Promise.allSettled(promises);
        }

        logger.info(
            `Batch notification completed: ${results.success.length} successful, ${results.failed.length} failed`,
        );
        return results;
    }
    /**
     * Validate FCM token format
     */
    public isValidToken(token: string): boolean {
        // FCM tokens are typically 163 characters long and contain alphanumeric characters, hyphens, and underscores
        const fcmTokenPattern = /^[a-zA-Z0-9_:-]{140,200}$/;
        return fcmTokenPattern.test(token);
    }
    /**
     * Send notification to a topic (mass notification)
     */
    public async sendTopicNotification(
        topic: string,
        title: string,
        body: string,
        data?: Record<string, string>,
        options?: {
            imageUrl?: string;
            clickAction?: string;
        },
    ) {
        try {
            const accessToken = await this.getAccessToken();
            const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

            const message: any = {
                message: {
                    topic,
                    notification: {
                        title,
                        body,
                    },
                    android: {
                        notification: {
                            title,
                            body,
                            click_action: options?.clickAction,
                            ...(options?.imageUrl && { image: options.imageUrl }),
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title,
                                    body,
                                },
                            },
                        },
                        ...(options?.imageUrl && {
                            fcm_options: {
                                image: options.imageUrl,
                            },
                        }),
                    },
                    webpush: {
                        notification: {
                            title,
                            body,
                            icon: '/icon-192x192.png',
                            ...(options?.imageUrl && { image: options.imageUrl }),
                        },
                        fcm_options: {
                            link: options?.clickAction || '/',
                        },
                    },
                },
            };

            if (data && Object.keys(data).length > 0) {
                message.message.data = data;
            }

            logger.debug(`Sending FCM topic notification to: ${topic}`);

            const response = await axios.post(fcmEndpoint, message, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000,
            });

            logger.info(`FCM topic notification sent successfully to: ${topic}`, {
                messageId: response.data.name,
            });

            return {
                success: true,
                messageId: response.data.name,
            };
        } catch (error: any) {
            logger.error(`FCM topic notification failed for: ${topic}`, error.message);
            throw new InternalServerError('Failed to send topic notification');
        }
    }
}

export default new FcmService();
