import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import Mail from 'nodemailer/lib/mailer';
import * as fs from 'node:fs';

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

    protected constructor(id: string, settings: Partial<OtpSettings> = {}) {
        this.id = id;
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
        const key = `otp:${this.id}`;

        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            logger.error(`No OTP found for ${this.id}`);
            throw new UnauthorizedError('No OTP found for this ID');
        }

        if (storedOtp === inputOtp) {
            // Delete the OTP after successful verification to prevent reuse
            await redisClient.del(key);
            logger.debug(`OTP verified successfully for ${this.id}`);
        } else {
            logger.debug(`Invalid OTP for ${this.id}`);
            throw new UnauthorizedError('Invalid OTP provided');
        }
    }

    /**
     * Check if an OTP exists for this ID
     */
    public async hasActiveOtp(): Promise<boolean> {
        const key = `otp:${this.id}`;
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
        const key = `otp:${this.id}`;
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
        const key = `otp:${this.id}`;

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
     * Generates a random 6-digit OTP
     */
    private generateOtp(): string {
        // Generate OTP with specified length
        const min = Math.pow(10, this.settings.otpLength - 1);
        const max = Math.pow(10, this.settings.otpLength) - 1;
        return Math.floor(min + Math.random() * (max - min)).toString();
    }
}

type EmailTemplate = 'login' | 'signup';

class EmailOtpVerification extends OtpVerification {
    private readonly template: EmailTemplate;

    constructor(email: string, template: EmailTemplate, settings?: Partial<OtpSettings>) {
        super(email, settings);
        this.template = template;
    }

    /**
     * Send OTP to the user's email
     */
    public async sendOtp(): Promise<void> {
        const content = fs.readFileSync(`templates/${this.template}-email.html`, 'utf-8');

        const otp = await this.storeOtp();

        const mailOptions: Mail.Options = {
            from: env.email.from,
            to: this.id,
            subject: 'Your Verification Code - Sapphire Broking',
            html: formatHtml(content, otp, this.id, undefined, this.settings.ip),
        };

        await transporter.sendMail(mailOptions);
        logger.debug(`Sent OTP ${otp} to ${this.id}`);
    }
}

class PhoneOtpVerification extends OtpVerification {
    private readonly email: string;
    private readonly template: EmailTemplate;

    constructor(email: string, template: EmailTemplate, phoneNumber: string, settings?: Partial<OtpSettings>) {
        super(phoneNumber);
        this.email = email;
        this.template = template;
    }

    /**
     * Send OTP to the user's phone
     */
    public async sendOtp(): Promise<void> {
        // FIXME
        // try {
        //     const otp = await this.storeOtp();
        //
        //     const message = `Welcome to Sapphire! Your OTP for signup is ${otp}. Do not share this OTP with anyone. It is valid for 10 minutes. - Sapphire Broking`;
        //     await smsService.sendSms(this.id, message, '1007898245699377543'); // FIXME: Remove raw template ID
        //     logger.debug(`Sent OTP ${otp} to ${this.id}`);
        // } catch (error) {
        //     logger.error(`Failed to send OTP to phone ${this.id}:`, error);
        //     throw new Error('Failed to send OTP via SMS');
        // }
        const content = fs.readFileSync(`templates/${this.template}-email.html`, 'utf-8');

        const otp = await this.storeOtp();

        const mailOptions: Mail.Options = {
            from: env.email.from,
            // to: this.id,
            to: this.email,
            subject: 'Your Phone Verification Code - Sapphire Broking',
            html: formatHtml(content, otp, this.email, this.id, this.settings.ip),
        };

        await transporter.sendMail(mailOptions);
        logger.debug(`Sent OTP ${otp} to ${this.id}`);
    }
}

function formatHtml(content: string, otp: string, email: string, phone?: string, ip?: string): string {
    return content
        .replace('{{ otp }}', otp)
        .replace(
            '{{ date }}',
            new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            }),
        )
        .replace(
            '{{ time }}',
            new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }),
        )
        .replace('{{ ip }}', ip || 'N/A')
        .replace('{{ email }}', email)
        .replace('{{ phone }}', phone || '');
}

export { EmailOtpVerification, PhoneOtpVerification };
