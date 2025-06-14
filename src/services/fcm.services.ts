import * as admin from 'firebase-admin';
import logger from '@app/logger';
import { env } from '@app/env';

interface FCMNotificationData {
    userName: string;
    userId: string;
    tokens: string[];
    date?: string;
    time?: string;
    ip?: string;
    deviceType?: string;
    location?: string;
    amount?: string;
    availableBalance?: string;
    creditHours?: string;
    reason?: string;
    marginShortfall?: string;
}

interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    clickAction?: string;
    data?: Record<string, string>;
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: env.firebase.projectId,
            clientEmail: env.firebase.clientEmail,
            privateKey: env.firebase.privateKey.replace(/\\n/g, '\n'),
        }),
        projectId: env.firebase.projectId,
    });
}

type FCMNotificationTemplate =
    | 'password-change-confirmation'
    | 'mpin-change-confirmation'
    | 'account-locked'
    | 'login-alert'
    | 'welcome'
    | 'withdrawal-processed'
    | 'account-successfully-opened'
    | 'documents-received-confirmation'
    | 'margin-shortfall-alert'
    | 'payout-rejected'
    | 'documents-rejected-notification'
    | 'kyc-update-required'
    | 'funds-added'
    | 'account-suspension-notice'
    | 'trade-executed'
    | 'market-alert'
    | 'price-alert';

class FCMNotificationService {
    private readonly template: FCMNotificationTemplate;

    constructor(template: FCMNotificationTemplate) {
        this.template = template;
    }

    public async sendNotification(data: FCMNotificationData): Promise<void> {
        try {
            if (!data.tokens || data.tokens.length === 0) {
                logger.warn(`No FCM tokens provided for ${this.template} notification`);
                return;
            }

            // Clean invalid tokens
            const validTokens = await this.cleanInvalidTokens(data.tokens);

            if (validTokens.length === 0) {
                logger.warn(`No valid FCM tokens for ${this.template} notification`);
                return;
            }

            const payload = this.buildNotificationPayload(data);
            await this.sendToTokens(validTokens, payload);

            logger.info(`Sent ${this.template} FCM notification to ${validTokens.length} devices`);
        } catch (error) {
            logger.error(`Failed to send ${this.template} FCM notification:`, error);
            throw error;
        }
    }

    /**
     * Send notification to specific tokens
     */
    private async sendToTokens(tokens: string[], payload: NotificationPayload): Promise<admin.messaging.BatchResponse> {
        try {
            const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: {
                    title: payload.title,
                    body: payload.body,
                    imageUrl: payload.image,
                },
                data: payload.data,
                webpush: payload.clickAction
                    ? {
                          notification: {
                              icon: payload.icon || '/icons/notification-icon.png',
                              requireInteraction: true,
                              actions: [
                                  {
                                      action: 'open',
                                      title: 'Open App',
                                  },
                              ],
                          },
                          fcmOptions: {
                              link: payload.clickAction,
                          },
                      }
                    : undefined,
                android: {
                    notification: {
                        icon: payload.icon,
                        clickAction: payload.clickAction,
                    },
                    priority: 'high',
                },
                apns: {
                    payload: {
                        aps: {
                            badge: 1,
                        },
                    },
                },
            };

            const response = await admin.messaging().sendEachForMulticast(message, false);

            // Log results
            if (response.failureCount > 0) {
                const failedTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(tokens[idx]);
                        logger.error(`Failed to send FCM to token ${tokens[idx]}: ${resp.error?.message}`);
                    }
                });
                logger.warn(`FCM batch send completed with ${response.failureCount} failures`);
            }

            return response;
        } catch (error) {
            logger.error('Failed to send FCM batch notification:', error);
            throw error;
        }
    }

    /**
     * Validate FCM token
     */
    private async validateToken(token: string): Promise<boolean> {
        try {
            const testMessage: admin.messaging.Message = {
                token,
                data: { test: 'true' },
            };

            await admin.messaging().send(testMessage, true);
            return true;
        } catch (error: any) {
            if (
                error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered'
            ) {
                return false;
            }
            return false;
        }
    }

    /**
     * Clean invalid tokens from a list
     */
    private async cleanInvalidTokens(tokens: string[]): Promise<string[]> {
        const validTokens: string[] = [];

        for (const token of tokens) {
            const isValid = await this.validateToken(token);
            if (isValid) {
                validTokens.push(token);
            }
        }

        return validTokens;
    }
    /**
     * Build notification payload based on template
     */
    private buildNotificationPayload(data: FCMNotificationData): NotificationPayload {
        const currentDate =
            data.date ||
            new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

        const currentTime =
            data.time ||
            new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

        const baseData = {
            template: this.template,
            userId: data.userId,
            timestamp: new Date().toISOString(),
        };

        switch (this.template) {
            case 'password-change-confirmation':
                return {
                    title: 'Password Changed Successfully',
                    body: `Hi ${data.userName}, your password has been changed successfully on ${currentDate} at ${currentTime}.`,
                    icon: '/icons/security.png',
                    clickAction: '/profile/security',
                    data: { ...baseData, type: 'security' },
                };

            case 'mpin-change-confirmation':
                return {
                    title: 'MPIN Changed Successfully',
                    body: `Hi ${data.userName}, your MPIN has been changed successfully on ${currentDate} at ${currentTime}.`,
                    icon: '/icons/security.png',
                    clickAction: '/profile/security',
                    data: { ...baseData, type: 'security' },
                };

            case 'account-locked':
                return {
                    title: 'Account Security Alert',
                    body: `Hi ${data.userName}, your account has been temporarily locked due to security reasons. Please contact support.`,
                    icon: '/icons/warning.png',
                    clickAction: '/support',
                    data: { ...baseData, type: 'security', priority: 'high' },
                };

            case 'login-alert':
                return {
                    title: 'New Login Detected',
                    body: `Hi ${data.userName}, a new login was detected from ${data.deviceType || 'Unknown Device'} on ${currentDate}.`,
                    icon: '/icons/login.png',
                    clickAction: '/profile/security',
                    data: {
                        ...baseData,
                        type: 'login',
                        ip: data.ip || '',
                        location: data.location || '',
                        deviceType: data.deviceType || '',
                    },
                };

            case 'welcome':
                return {
                    title: 'Welcome to Sapphire Broking',
                    body: `Hi ${data.userName}, welcome to Sapphire Broking! Start your investment journey with us.`,
                    icon: '/icons/welcome.png',
                    clickAction: '/dashboard',
                    data: { ...baseData, type: 'welcome' },
                };

            case 'funds-added':
                return {
                    title: 'Funds Added Successfully',
                    body: `Hi ${data.userName}, ₹${data.amount} has been added to your account. Available balance: ₹${data.availableBalance}`,
                    icon: '/icons/money.png',
                    clickAction: '/funds',
                    data: {
                        ...baseData,
                        type: 'funds',
                        amount: data.amount || '',
                        availableBalance: data.availableBalance || '',
                    },
                };

            case 'withdrawal-processed':
                return {
                    title: 'Withdrawal Processed',
                    body: `Hi ${data.userName}, your withdrawal of ₹${data.amount} has been processed successfully.`,
                    icon: '/icons/withdrawal.png',
                    clickAction: '/transactions',
                    data: {
                        ...baseData,
                        type: 'withdrawal',
                        amount: data.amount || '',
                    },
                };

            case 'margin-shortfall-alert':
                return {
                    title: 'Margin Shortfall Alert',
                    body: `Hi ${data.userName}, you have a margin shortfall of ₹${data.marginShortfall}. Please add funds immediately.`,
                    icon: '/icons/alert.png',
                    clickAction: '/funds/add',
                    data: {
                        ...baseData,
                        type: 'margin',
                        priority: 'high',
                        marginShortfall: data.marginShortfall || '',
                    },
                };

            case 'account-successfully-opened':
                return {
                    title: 'Account Successfully Opened',
                    body: `Hi ${data.userName}, congratulations! Your trading account has been successfully opened.`,
                    icon: '/icons/success.png',
                    clickAction: '/dashboard',
                    data: { ...baseData, type: 'account-status' },
                };

            case 'documents-received-confirmation':
                return {
                    title: 'Documents Received',
                    body: `Hi ${data.userName}, we have received your documents and they are under review.`,
                    icon: '/icons/documents.png',
                    clickAction: '/profile/documents',
                    data: { ...baseData, type: 'documents' },
                };

            case 'payout-rejected':
                return {
                    title: 'Payout Request Rejected',
                    body: `Hi ${data.userName}, your payout request has been rejected. Reason: ${data.reason || 'Please contact support'}.`,
                    icon: '/icons/error.png',
                    clickAction: '/transactions',
                    data: {
                        ...baseData,
                        type: 'payout',
                        reason: data.reason || '',
                    },
                };

            case 'documents-rejected-notification':
                return {
                    title: 'Documents Rejected',
                    body: `Hi ${data.userName}, your submitted documents have been rejected. Please resubmit with correct information.`,
                    icon: '/icons/warning.png',
                    clickAction: '/profile/documents',
                    data: {
                        ...baseData,
                        type: 'documents',
                        reason: data.reason || '',
                    },
                };

            case 'kyc-update-required':
                return {
                    title: 'KYC Update Required',
                    body: `Hi ${data.userName}, please update your KYC information to continue using our services.`,
                    icon: '/icons/kyc.png',
                    clickAction: '/profile/kyc',
                    data: { ...baseData, type: 'kyc' },
                };

            case 'account-suspension-notice':
                return {
                    title: 'Account Suspension Notice',
                    body: `Hi ${data.userName}, your account has been suspended. Please contact support for assistance.`,
                    icon: '/icons/suspension.png',
                    clickAction: '/support',
                    data: {
                        ...baseData,
                        type: 'suspension',
                        priority: 'high',
                    },
                };

            case 'trade-executed':
                return {
                    title: 'Trade Executed',
                    body: `Hi ${data.userName}, your trade has been executed successfully.`,
                    icon: '/icons/trade.png',
                    clickAction: '/orders',
                    data: { ...baseData, type: 'trade' },
                };

            case 'market-alert':
                return {
                    title: 'Market Alert',
                    body: `Hi ${data.userName}, important market update available.`,
                    icon: '/icons/market.png',
                    clickAction: '/market',
                    data: { ...baseData, type: 'market' },
                };

            case 'price-alert':
                return {
                    title: 'Price Alert',
                    body: `Hi ${data.userName}, your price alert has been triggered.`,
                    icon: '/icons/price.png',
                    clickAction: '/watchlist',
                    data: { ...baseData, type: 'price-alert' },
                };

            default:
                return {
                    title: 'Notification - Sapphire Broking',
                    body: `Hi ${data.userName}, you have a new notification.`,
                    icon: '/icons/notification.png',
                    clickAction: '/notifications',
                    data: { ...baseData, type: 'general' },
                };
        }
    }
}

// Utility class for FCM operations
class FCMUtility {
    /**
     * Send notification to topic
     */
    static async sendToTopic(
        topic: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<string> {
        try {
            const message: admin.messaging.Message = {
                topic,
                notification: { title, body },
                data,
                webpush: {
                    notification: {
                        icon: '/icons/notification-icon.png',
                        badge: '/icons/badge-icon.png',
                    },
                },
            };

            const response = await admin.messaging().send(message);
            logger.info(`FCM topic notification sent successfully: ${response}`);
            return response;
        } catch (error) {
            logger.error(`Failed to send FCM topic notification to ${topic}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe tokens to topic
     */
    static async subscribeToTopic(
        tokens: string[],
        topic: string,
    ): Promise<admin.messaging.MessagingTopicManagementResponse> {
        try {
            const response = await admin.messaging().subscribeToTopic(tokens, topic);
            logger.info(`Subscribed ${response.successCount} tokens to topic: ${topic}`);
            return response;
        } catch (error) {
            logger.error(`Failed to subscribe tokens to topic ${topic}:`, error);
            throw error;
        }
    }

    /**
     * Unsubscribe tokens from topic
     */
    static async unsubscribeFromTopic(
        tokens: string[],
        topic: string,
    ): Promise<admin.messaging.MessagingTopicManagementResponse> {
        try {
            const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
            logger.info(`Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
            return response;
        } catch (error) {
            logger.error(`Failed to unsubscribe tokens from topic ${topic}:`, error);
            throw error;
        }
    }
}

// Helper functions following your existing pattern
export async function sendPasswordChangeConfirmationFCM(
    tokens: string[],
    userData: FCMNotificationData,
): Promise<void> {
    const fcmService = new FCMNotificationService('password-change-confirmation');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendMpinChangeConfirmationFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('mpin-change-confirmation');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendAccountLockedNotificationFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('account-locked');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendLoginAlertFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('login-alert');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendWelcomeFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('welcome');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendWithdrawalProcessedFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('withdrawal-processed');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendAccountSuccessfullyOpenedFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('account-successfully-opened');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendDocumentsReceivedConfirmationFCM(
    tokens: string[],
    userData: FCMNotificationData,
): Promise<void> {
    const fcmService = new FCMNotificationService('documents-received-confirmation');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendMarginShortfallAlertFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('margin-shortfall-alert');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendPayoutRejectedFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('payout-rejected');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendDocumentsRejectedNotificationFCM(
    tokens: string[],
    userData: FCMNotificationData,
): Promise<void> {
    const fcmService = new FCMNotificationService('documents-rejected-notification');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendKycUpdateRequiredFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('kyc-update-required');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendFundsAddedFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('funds-added');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendAccountSuspensionNoticeFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('account-suspension-notice');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendTradeExecutedFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('trade-executed');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendMarketAlertFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('market-alert');
    await fcmService.sendNotification({ ...userData, tokens });
}

export async function sendPriceAlertFCM(tokens: string[], userData: FCMNotificationData): Promise<void> {
    const fcmService = new FCMNotificationService('price-alert');
    await fcmService.sendNotification({ ...userData, tokens });
}

export { FCMNotificationService, FCMUtility, FCMNotificationData, FCMNotificationTemplate };
