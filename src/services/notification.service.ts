import logger from '@app/logger';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';

interface NotificationData {
    userName: string;
    email: string;
    date?: string;
    time?: string;
    ip?: string;
    deviceType?: string;
    location?: string;
}

type NotificationTemplate = 'password-change-confirmation' | 'account-locked' | 'login-alert' | 'welcome';

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
            case 'account-locked':
                return 'Account Security Alert - Sapphire Broking';
            case 'login-alert':
                return 'New Login Detected - Sapphire Broking';
            case 'welcome':
                return 'Welcome to Sapphire Broking';
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
            .replace(/\[Location\]/g, data.location || 'Unknown Location');
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

export { EmailNotificationService, NotificationData, NotificationTemplate };
