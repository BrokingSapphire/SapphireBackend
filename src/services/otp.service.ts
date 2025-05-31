import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';
// Replace the current Handlebars import
// import Handlebars from 'handlebars';
// With:
import Handlebars from '@app/services/handlebars-helpers';

export const DEFAULT_OTP_LENGTH = 6;
export const DEFAULT_OTP_EXPIRY = 10 * 60; // 10 minutes in seconds

interface OtpSettings {
    otpExpiry: number; // Expiry time in seconds
    otpLength: number;
    ip?: string;
}

abstract class OtpVerification {
    protected readonly id: string; // Unique identifier (email or phone)
    protected readonly settings: OtpSettings;
    protected readonly context: string; // Add context to distinguish different OTP types

    protected constructor(id: string, context: string = 'default', settings: Partial<OtpSettings> = {}) {
        this.id = id;
        this.context = context;
        this.settings = {
            ...settings,
            otpExpiry: settings.otpExpiry || DEFAULT_OTP_EXPIRY,
            otpLength: settings.otpLength || DEFAULT_OTP_LENGTH,
        };
    }

    /**
     * Send OTP to the user - to be implemented by subclasses
     */
    public abstract sendOtp(): Promise<void>;

    /**
     * Verify the OTP provided by the user
     */
    public async verifyOtp(inputOtp: string): Promise<void> {
        const key = `otp:${this.context}:${this.id}`; // Include context in key

        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            logger.error(`No OTP found for ${this.id} with context ${this.context}`);
            throw new UnauthorizedError('No OTP found for this ID');
        }

        if (storedOtp === inputOtp) {
            // Delete the OTP after successful verification to prevent reuse
            await redisClient.del(key);
            logger.debug(`OTP verified successfully for ${this.id} with context ${this.context}`);
        } else {
            logger.debug(`Invalid OTP for ${this.id} with context ${this.context}`);
            throw new UnauthorizedError('Invalid OTP provided');
        }
    }

    /**
     * Check if an OTP exists for this ID
     */
    public async hasActiveOtp(): Promise<boolean> {
        const key = `otp:${this.context}:${this.id}`;
        try {
            const exists = await redisClient.exists(key);
            return exists === 1;
        } catch (error) {
            logger.debug('Error checking OTP existence:', error);
            return false;
        }
    }

    /**
     * Get remaining time before OTP expires (in seconds)
     */
    public async getOtpTtl(): Promise<number> {
        const key = `otp:${this.context}:${this.id}`;
        try {
            return await redisClient.ttl(key);
        } catch (error) {
            logger.debug('Error getting OTP TTL:', error);
            return 0;
        }
    }

    /**
     * Stores OTP in Redis with expiration
     */
    protected async storeOtp(): Promise<string> {
        const otp = this.generateOtp();
        const key = `otp:${this.context}:${this.id}`; // Include context in key

        try {
            await redisClient.set(key, otp);
            await redisClient.expire(key, this.settings.otpExpiry);
            return otp;
        } catch (error) {
            logger.error('Error storing OTP in Redis:', error);
            throw new Error('Failed to generate OTP');
        }
    }

    /**
     * Generates a random OTP with specified length
     */
    private generateOtp(): string {
        // Generate OTP with specified length
        const min = Math.pow(10, this.settings.otpLength - 1);
        const max = Math.pow(10, this.settings.otpLength) - 1;
        return Math.floor(min + Math.random() * (max - min)).toString();
    }
}

type EmailTemplate = 'login' | 'signup' | 'forgot-password';

class EmailOtpVerification extends OtpVerification {
    private readonly template: EmailTemplate;
    private static readonly templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

    constructor(email: string, template: EmailTemplate, settings?: Partial<OtpSettings>) {
        // Use template as context to create unique Redis keys
        super(email, template, settings);
        this.template = template;
    }

    /**
     * Send OTP to the user's email
     */
    public async sendOtp(): Promise<void> {
        // Find the appropriate template path
        const templatePath = this.findTemplatePath();
        if (!templatePath) {
            logger.error(`Template file not found for: ${this.template}`);
            throw new Error(`Template file not found for: ${this.template}`);
        }

        // Get compiled template from cache or compile it
        let compiledTemplate = EmailOtpVerification.templateCache.get(templatePath);
        if (!compiledTemplate) {
            const content = fs.readFileSync(templatePath, 'utf-8');
            compiledTemplate = Handlebars.compile(content);
            EmailOtpVerification.templateCache.set(templatePath, compiledTemplate);
        }

        const otp = await this.storeOtp();

        const templateData = {
            otp,
            email: this.id,
            date: new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            }),
            time: new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }),
            ip: this.settings.ip || 'N/A',
            userName: this.id.split('@')[0], // Basic fallback if userName is not provided

            // Account details
            accountNumber: 'N/A',
            clientId: 'N/A',
            accountType: 'N/A',

            // Transaction details
            transactionId: 'N/A',
            amount: 'N/A',
            currency: 'INR',
            transactionDate: 'N/A',
            transactionTime: 'N/A',
            transactionStatus: 'N/A',

            // Document details
            documentType: 'N/A',
            documentStatus: 'N/A',
            submissionDate: 'N/A',

            // Support details
            ticketId: 'N/A',
            ticketStatus: 'N/A',
            ticketSubject: 'N/A',
        };

        const mailOptions: Mail.Options = {
            from: env.email.from,
            to: this.id,
            subject: this.getSubject(),
            html: compiledTemplate(templateData),
        };

        await transporter.sendMail(mailOptions);
        logger.debug(`Sent OTP ${otp} to ${this.id} for ${this.template}`);
    }

    /**
     * Find the template path based on template type
     */
    private findTemplatePath(): string | null {
        // First check the original location
        const originalPath = `templates/${this.template}-email.html`;
        if (fs.existsSync(originalPath)) {
            return originalPath;
        }

        // Check in the new categorized structure
        const templateMap: Record<string, string> = {
            login: 'templates/otp/login_otp.html',
            signup: 'templates/otp/signup_otp.html',
            'forgot-password': 'templates/security-and-support/password_reset.html',
        };

        const mappedPath = templateMap[this.template];
        if (mappedPath && fs.existsSync(mappedPath)) {
            return mappedPath;
        }

        return null;
    }

    private getSubject(): string {
        switch (this.template) {
            case 'forgot-password':
                return 'Password Reset Code - Sapphire Broking';
            case 'signup':
                return 'Welcome to Sapphire - Verification Code';
            case 'login':
            default:
                return 'Your Verification Code - Sapphire Broking';
        }
    }
}

class PhoneOtpVerification extends OtpVerification {
    private readonly email: string;
    private readonly template: EmailTemplate;
    private static readonly templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

    constructor(email: string, template: EmailTemplate, phoneNumber: string, settings?: Partial<OtpSettings>) {
        super(phoneNumber, `phone_${template}`, settings);
        this.email = email;
        this.template = template;
    }

    /**
     * Send OTP to the user's phone
     */
    public async sendOtp(): Promise<void> {
        // Find the appropriate template path
        const templatePath = this.findTemplatePath();
        if (!templatePath) {
            logger.error(`Template file not found for: ${this.template}`);
            throw new Error(`Template file not found for: ${this.template}`);
        }

        // Get compiled template from cache or compile it
        let compiledTemplate = PhoneOtpVerification.templateCache.get(templatePath);
        if (!compiledTemplate) {
            const content = fs.readFileSync(templatePath, 'utf-8');
            compiledTemplate = Handlebars.compile(content);
            PhoneOtpVerification.templateCache.set(templatePath, compiledTemplate);
        }

        const otp = await this.storeOtp();

        const templateData = {
            otp,
            email: this.email,
            phone: this.id,
            date: new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            }),
            time: new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }),
            ip: this.settings.ip || 'N/A',
            userName: this.email.split('@')[0], // Basic fallback if userName is not provided
        };

        const mailOptions: Mail.Options = {
            from: env.email.from,
            to: this.email,
            subject: 'Your Phone Verification Code - Sapphire Broking',
            html: compiledTemplate(templateData),
        };

        await transporter.sendMail(mailOptions);
    }

    /**
     * Find the template path based on template type
     */
    private findTemplatePath(): string | null {
        // First check the original location
        const originalPath = `templates/${this.template}-email.html`;
        if (fs.existsSync(originalPath)) {
            return originalPath;
        }

        // Check in the new categorized structure
        const templateMap: Record<string, string> = {
            login: 'templates/otp/login_otp.html',
            signup: 'templates/otp/signup_otp.html',
            'forgot-password': 'templates/security-and-support/password_reset.html',
        };

        const mappedPath = templateMap[this.template];
        if (mappedPath && fs.existsSync(mappedPath)) {
            return mappedPath;
        }

        return null;
    }
}

// Remove the formatHtml function as it's no longer needed

export { EmailOtpVerification, PhoneOtpVerification };
