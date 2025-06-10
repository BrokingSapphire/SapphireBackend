import logger from '@app/logger';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';
import smsService from './sms.service';
import { SmsTemplateType } from './sms-templates/sms.types';

interface NotificationData {
    userName: string;
    email: string;
    phoneNumber?: string;
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

type NotificationTemplate =
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
    | 'account-suspension-notice';

class EmailNotificationService {
    private readonly email: string;
    private readonly template: NotificationTemplate;

    constructor(email: string, template: NotificationTemplate) {
        this.email = email;
        this.template = template;
    }

    /**
     * Send notification email
     */
    public async sendNotification(data: NotificationData): Promise<void> {
        try {
            // Check if template file exists
            const templatePath = `templates/${this.template}-email.html`;
            if (!fs.existsSync(templatePath)) {
                logger.error(`Template file not found: ${templatePath}`);
                throw new Error(`Template file not found: ${this.template}-email.html`);
            }

            const content = fs.readFileSync(templatePath, 'utf-8');

            const mailOptions: Mail.Options = {
                from: env.email.from,
                to: this.email,
                subject: this.getSubject(),
                html: this.formatNotificationHtml(content, data),
            };

            await transporter.sendMail(mailOptions);
            logger.debug(`Sent ${this.template} notification to ${this.email}`);
        } catch (error) {
            logger.error(`Failed to send ${this.template} notification to ${this.email}:`, error);
            throw error;
        }
    }

    /**
     * Get email subject based on template type
     */
    private getSubject(): string {
        switch (this.template) {
            case 'password-change-confirmation':
                return 'Password Changed Successfully - Sapphire Broking';
            case 'mpin-change-confirmation':
                return 'MPIN Changed Successfully - Sapphire Broking';
            case 'account-locked':
                return 'Account Security Alert - Sapphire Broking';
            case 'login-alert':
                return 'New Login Detected - Sapphire Broking';
            case 'welcome':
                return 'Welcome to Sapphire Broking';
            case 'withdrawal-processed':
                return 'Withdrawal Processed Successfully - Sapphire Broking';
            case 'account-successfully-opened':
                return 'Welcome to Sapphire - Account Successfully Opened';
            case 'documents-received-confirmation':
                return 'Documents Received - Sapphire Broking';
            case 'margin-shortfall-alert':
                return 'Margin Shortfall Alert - Sapphire Broking';
            case 'payout-rejected':
                return 'Payout Request Rejected - Sapphire Broking';
            case 'documents-rejected-notification':
                return 'Documents Rejected - Sapphire Broking';
            case 'kyc-update-required':
                return 'KYC Update Required - Sapphire Broking';
            case 'funds-added':
                return 'Funds Added Successfully - Sapphire Broking';
            case 'account-suspension-notice':
                return 'Account Suspension Notice - Sapphire Broking';
            default:
                return 'Notification - Sapphire Broking';
        }
    }

    /**
     * Format HTML template with notification data
     */
    private formatNotificationHtml(content: string, data: NotificationData): string {
        const currentDate =
            data.date ||
            new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            });

        const currentTime =
            data.time ||
            new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

        return content
            .replace(/{{ userName }}/g, data.userName)
            .replace(/{{ email }}/g, data.email)
            .replace(/{{ date }}/g, currentDate)
            .replace(/{{ time }}/g, currentTime)
            .replace(/{{ ip }}/g, data.ip || 'N/A')
            .replace(/\[Device Type\]/g, data.deviceType || 'Unknown Device')
            .replace(/\[Location\]/g, data.location || 'Unknown Location')
            .replace(/{{ amount }}/g, data.amount || 'N/A')
            .replace(/{{ availableBalance }}/g, data.availableBalance || 'N/A')
            .replace(/{{ creditHours }}/g, data.creditHours || 'N/A')
            .replace(/{{ reason }}/g, data.reason || 'N/A')
            .replace(/{{ marginShortfall }}/g, data.marginShortfall || 'N/A');
    }
}

/**
 * Helper function to send password change confirmation
 */
export async function sendPasswordChangeConfirmation(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'password-change-confirmation');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send MPIN change confirmation
 */
export async function sendMpinChangeConfirmation(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'mpin-change-confirmation');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send account locked notification
 */
export async function sendAccountLockedNotification(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'account-locked');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send login alert
 */
export async function sendLoginAlert(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'login-alert');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send welcome email
 */
export async function sendWelcomeEmail(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'welcome');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send withdrawal processed notification
 */
export async function sendWithdrawalProcessed(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'withdrawal-processed');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send account successfully opened notification
 */
export async function sendAccountSuccessfullyOpened(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'account-successfully-opened');
    await notificationService.sendNotification(userData);

    if (userData.phoneNumber) {
        try {
            await smsService.sendTemplatedSms(userData.phoneNumber, SmsTemplateType.ACCOUNT_SUCCESSFULLY_OPENED, [
                userData.userName,
            ]);
            logger.info(`Account successfully opened SMS sent to ${userData.phoneNumber}`);
        } catch (error) {
            logger.error(`Failed to send account successfully opened SMS: ${error}`);
        }
    }
}

/**
 * Helper function to send documents received confirmation
 */
export async function sendDocumentsReceivedConfirmation(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'documents-received-confirmation');
    await notificationService.sendNotification(userData);

    if (userData.phoneNumber) {
        try {
            await smsService.sendTemplatedSms(userData.phoneNumber, SmsTemplateType.DOCUMENTS_RECEIVED_CONFIRMATION, [
                userData.userName,
            ]);
            logger.info(`Documents received confirmation SMS sent to ${userData.phoneNumber}`);
        } catch (error) {
            // Log but don't throw - if SMS fails, email was still sent
            logger.error(`Failed to send documents received SMS: ${error}`);
        }
    }
}

/**
 * Helper function to send margin shortfall alert
 */
export async function sendMarginShortfallAlert(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'margin-shortfall-alert');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send payout rejected notification
 */
export async function sendPayoutRejected(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'payout-rejected');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send documents rejected notification
 */
export async function sendDocumentsRejectedNotification(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'documents-rejected-notification');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send KYC update required notification
 */
export async function sendKycUpdateRequired(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'kyc-update-required');
    await notificationService.sendNotification(userData);
}

/**
 * Helper function to send funds added notification
 */
export async function sendFundsAdded(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'funds-added');
    await notificationService.sendNotification(userData);

    if (userData.phoneNumber && userData.amount && userData.availableBalance) {
        try {
            await smsService.sendTemplatedSms(userData.phoneNumber, SmsTemplateType.FUNDS_ADDED, [
                userData.userName,
                userData.amount,
                userData.availableBalance,
            ]);
            logger.info(`Funds added SMS sent to ${userData.phoneNumber}`);
        } catch (error) {
            // Log but don't throw - if SMS fails, email was still sent
            logger.error(`Failed to send funds added SMS: ${error}`);
        }
    }
}

/**
 * Helper function to send account suspension notice
 */
export async function sendAccountSuspensionNotice(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'account-suspension-notice');
    await notificationService.sendNotification(userData);
}

export { EmailNotificationService, NotificationData, NotificationTemplate };
