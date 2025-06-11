import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';
import smsService from '@app/services/sms.service';

export const DEFAULT_OTP_LENGTH = 6;
export const DEFAULT_OTP_EXPIRY = 10 * 60; // 10 minutes in seconds

interface OtpSettings {
    otpExpiry: number; // Expiry time in seconds
    otpLength: number;
    ip?: string;
}

abstract class OtpVerification {
    protected readonly id: string;
    protected readonly settings: OtpSettings;
    protected readonly context: string;

    protected constructor(id: string, context: string = 'default', settings: Partial<OtpSettings> = {}) {
        this.id = id;
        this.context = context;
        this.settings = {
            ...settings,
            otpExpiry: settings.otpExpiry || DEFAULT_OTP_EXPIRY,
            otpLength: settings.otpLength || DEFAULT_OTP_LENGTH,
        };

        logger.debug(`Creating OTP verification for ID: ${this.id}, context: ${this.context}`);
    }

    /**
     * Send OTP to the user - to be implemented by subclasses
     */
    public abstract sendOtp(): Promise<void>;

    /**
     * Verify the OTP provided by the user
     */
    public async verifyOtp(inputOtp: string): Promise<void> {
        const key = `otp:${this.context}:${this.id}`;
        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            logger.error(`No OTP found for ${this.id} with context ${this.context}`);
            throw new UnauthorizedError('No OTP found for this ID');
        }

        if (storedOtp === inputOtp) {
            // Delete the OTP after successful verification to prevent reuse
            await redisClient.del(key);
        } else {
            logger.warn(
                `Invalid OTP provided for ${this.id} with context ${this.context}. Expected: ${storedOtp}, Got: ${inputOtp}`,
            );
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
            logger.debug(`Checking OTP existence for ${key}: ${exists === 1 ? 'exists' : 'not found'}`);
            return exists === 1;
        } catch (error) {
            logger.error('Error checking OTP existence:', error);
            return false;
        }
    }

    /**
     * Get remaining time before OTP expires (in seconds)
     */
    public async getOtpTtl(): Promise<number> {
        const key = `otp:${this.context}:${this.id}`;
        try {
            const ttl = await redisClient.ttl(key);
            logger.debug(`OTP TTL for ${key}: ${ttl} seconds`);
            return ttl;
        } catch (error) {
            logger.error('Error getting OTP TTL:', error);
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
            logger.info(`OTP stored successfully for key: ${key}, expires in ${this.settings.otpExpiry} seconds`);
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
        const otp = Math.floor(min + Math.random() * (max - min)).toString();
        logger.debug(`Generated OTP of length ${this.settings.otpLength}`);
        return otp;
    }
}

type EmailTemplate = 'login' | 'signup' | 'forgot-password' | 'forgot-mpin';

class EmailOtpVerification extends OtpVerification {
    private readonly template: EmailTemplate;

    constructor(email: string, template: EmailTemplate, settings?: Partial<OtpSettings>) {
        // Use template as context to create unique Redis keys
        super(email, `email-otp:${template}`, settings);
        this.template = template;
        logger.info(`Initializing Email OTP verification for: ${email}, template: ${template}`);
    }

    /**
     * Send OTP to the user's email
     */
    public async sendOtp(): Promise<void> {
        let templateFile = this.template;
        try {
            fs.accessSync(`templates/${this.template}-email.html`);
        } catch (error) {
            logger.warn(`Template ${this.template}-email.html not found, using login template`);
            templateFile = 'login';
        }

        const content = fs.readFileSync(`templates/${templateFile}-email.html`, 'utf-8');

        const otp = await this.storeOtp();

        const mailOptions: Mail.Options = {
            from: env.email.from,
            to: this.id,
            subject: this.getSubject(),
            html: formatHtml(content, otp, this.id, undefined, this.settings.ip),
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`Email OTP sent successfully to ${this.id} for ${this.template}`);
        } catch (error) {
            logger.error(`Failed to send email OTP to ${this.id}:`, error);
            throw error;
        }
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

    constructor(email: string, template: EmailTemplate, phoneNumber: string, settings?: Partial<OtpSettings>) {
        super(phoneNumber, `phone-otp:${template}:${email}`, settings);
        this.email = email;
        this.template = template;
        logger.info(
            `Initializing Phone OTP verification for phone: ${phoneNumber}, email: ${email}, template: ${template}`,
        );
    }

    /**
     * Send OTP to the user's phone via SMS only
     */
    public async sendOtp(): Promise<void> {
        const otp = await this.storeOtp();

        // Send SMS only
        try {
            const smsResult = await smsService.sendOtpSms(
                this.id, // Phone number
                otp,
                this.template, // Context (signup, login, etc.)
            );

            if (!smsResult) {
                throw new Error('SMS service returned false - template not found or other issue');
            }
        } catch (error) {
            logger.error(`Failed to send phone OTP via SMS to ${this.id}:`, error);

            throw new Error(`Failed to send SMS OTP: ${error instanceof Error ? error.message : error}`);
        }
    }
}

function formatHtml(content: string, otp: string, email: string, phone?: string, ip?: string): string {
    return content
        .replace(/{{ otp }}/g, otp)
        .replace(
            /{{ date }}/g,
            new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            }),
        )
        .replace(
            /{{ time }}/g,
            new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }),
        )
        .replace(/{{ ip }}/g, ip || 'N/A')
        .replace(/{{ email }}/g, email)
        .replace(/{{ phone }}/g, phone || '');
}

export { EmailOtpVerification, PhoneOtpVerification };
