import logger from '@app/logger';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';

import Handlebars from '@app/services/handlebars-helpers';
import * as path from 'path';

interface NotificationData {
    userName: string;
    email: string;
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

    // Account details
    accountNumber?: string;
    clientId?: string;
    accountType?: string;

    // Transaction details
    transactionId?: string;
    currency?: string;
    transactionDate?: string;
    transactionTime?: string;
    transactionStatus?: string;

    // Document details
    documentType?: string;
    documentStatus?: string;
    submissionDate?: string;

    // Support details
    ticketId?: string;
    ticketStatus?: string;
    ticketSubject?: string;
}

type NotificationTemplate =
    | 'password-change-confirmation'
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

// Register partials
const partialsDir = path.join(process.cwd(), 'templates', 'partials');
if (fs.existsSync(partialsDir)) {
    const partialFiles = fs.readdirSync(partialsDir).filter((file) => file.endsWith('.hbs'));
    partialFiles.forEach((file) => {
        const partialName = path.basename(file, '.hbs');
        const partialContent = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
        Handlebars.registerPartial(partialName, partialContent);
    });
}

class EmailNotificationService {
    private readonly email: string;
    private readonly template: NotificationTemplate;
    private static readonly templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

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
            const templatePath = this.findTemplatePath();
            if (!templatePath) {
                logger.error(`Template file not found for: ${this.template}`);
                throw new Error(`Template file not found for: ${this.template}`);
            }

            // Get compiled template from cache or compile it
            let compiledTemplate = EmailNotificationService.templateCache.get(templatePath);
            if (!compiledTemplate) {
                const content = fs.readFileSync(templatePath, 'utf-8');
                compiledTemplate = Handlebars.compile(content);
                EmailNotificationService.templateCache.set(templatePath, compiledTemplate);
            }

            const mailOptions: Mail.Options = {
                from: env.email.from,
                to: this.email,
                subject: this.getSubject(),
                html: compiledTemplate(this.prepareTemplateData(data)),
            };

            await transporter.sendMail(mailOptions);
            logger.debug(`Sent ${this.template} notification to ${this.email}`);
        } catch (error) {
            logger.error(`Failed to send ${this.template} notification to ${this.email}:`, error);
            throw error;
        }
    }

    /**
     * Find the template path based on template type
     * Checks both the original location and the new categorized structure
     */
    private findTemplatePath(): string | null {
        // First check the original location
        const originalPath = `templates/${this.template}-email.html`;
        if (fs.existsSync(originalPath)) {
            return originalPath;
        }

        // Check in the new categorized structure
        const templateMap: Record<string, string> = {
            'account-successfully-opened': 'templates/account-related/welcome_email.html',
            'documents-received-confirmation': 'templates/account-related/kyc_submission.html',
            'login-alert': 'templates/security-and-support/suspicious_login.html',
            'margin-shortfall-alert': 'templates/transaction/margin_call.html',
            'payout-rejected': 'templates/transaction/fund_withdrawal.html',
            'withdrawal-processed': 'templates/transaction/fund_withdrawal.html',
            'funds-added': 'templates/transaction/fund_deposit.html',
            'password-change-confirmation': 'templates/security-and-support/password_reset.html',
            'account-locked': 'templates/security-and-support/suspicious_login.html',
            welcome: 'templates/account-related/welcome_email.html',
            'documents-rejected-notification': 'templates/account-related/account_rejection.html',
            'kyc-update-required': 'templates/account-related/kyc_submission.html',
            'account-suspension-notice': 'templates/account-related/account_suspension.html',
        };

        const mappedPath = templateMap[this.template];
        if (mappedPath && fs.existsSync(mappedPath)) {
            return mappedPath;
        }

        return null;
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
     * Prepare data for template rendering
     */
    private prepareTemplateData(data: NotificationData): Record<string, any> {
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

        return {
            // Common template data
            title: this.getTitle(),
            brand: this.getBrand(),
            logoUrl: 'https://www.sapphirebroking.com/logo-white.svg',
            showBrandText: true,
            year: new Date().getFullYear(),
            disclaimer: this.getDisclaimer(),

            // User data
            userName: data.userName,
            email: data.email,
            date: currentDate,
            time: currentTime,
            ip: data.ip || 'N/A',
            deviceType: data.deviceType || 'Unknown Device',
            location: data.location || 'Unknown Location',
            amount: data.amount || 'N/A',
            availableBalance: data.availableBalance || 'N/A',
            creditHours: data.creditHours || 'N/A',
            reason: data.reason || 'N/A',
            marginShortfall: data.marginShortfall || 'N/A',

            // Account details
            accountNumber: data.accountNumber || 'N/A',
            clientId: data.clientId || 'N/A',
            accountType: data.accountType || 'N/A',

            // Transaction details
            transactionId: data.transactionId || 'N/A',
            currency: data.currency || 'INR',
            transactionDate: data.transactionDate || currentDate,
            transactionTime: data.transactionTime || currentTime,
            transactionStatus: data.transactionStatus || 'N/A',

            // Document details
            documentType: data.documentType || 'N/A',
            documentStatus: data.documentStatus || 'N/A',
            submissionDate: data.submissionDate || currentDate,

            // Support details
            ticketId: data.ticketId || 'N/A',
            ticketStatus: data.ticketStatus || 'N/A',
            ticketSubject: data.ticketSubject || 'N/A',
        };
    }

    /**
     * Get the title for the email
     */
    private getTitle(): string {
        switch (this.template) {
            case 'password-change-confirmation':
                return 'Password Changed Successfully';
            case 'account-locked':
                return 'Account Security Alert';
            case 'login-alert':
                return 'New Login Detected';
            case 'welcome':
                return 'Welcome';
            case 'withdrawal-processed':
                return 'Withdrawal Processed Successfully';
            case 'account-successfully-opened':
                return 'Welcome to Sapphire - Account Successfully Opened';
            case 'documents-received-confirmation':
                return 'Documents Received';
            case 'margin-shortfall-alert':
                return 'Margin Shortfall Alert';
            case 'payout-rejected':
                return 'Payout Request Rejected';
            case 'documents-rejected-notification':
                return 'Documents Rejected';
            case 'kyc-update-required':
                return 'KYC Update Required';
            case 'funds-added':
                return 'Funds Added Successfully';
            case 'account-suspension-notice':
                return 'Account Suspension Notice';
            default:
                return 'Notification';
        }
    }

    /**
     * Get the brand name
     */
    private getBrand(): string {
        // You can customize this based on the template or other factors
        return 'Broking';
    }

    /**
     * Get the disclaimer text
     */
    private getDisclaimer(): string {
        // You can customize this based on the template
        return 'DISCLAIMER: Investments in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI, membership of BSE, NSE, and MCX-SX, and registration of the DP with SEBI does not guarantee quality of services. Details of compliance officer: Name: Compliance Officer, Email: compliance@sapphirebroking.com, Phone: +91 XXXX XXX XXX';
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
}

/**
 * Helper function to send documents received confirmation
 */
export async function sendDocumentsReceivedConfirmation(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'documents-received-confirmation');
    await notificationService.sendNotification(userData);
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
}

/**
 * Helper function to send account suspension notice
 */
export async function sendAccountSuspensionNotice(email: string, userData: NotificationData): Promise<void> {
    const notificationService = new EmailNotificationService(email, 'account-suspension-notice');
    await notificationService.sendNotification(userData);
}

export { EmailNotificationService, NotificationData, NotificationTemplate };
