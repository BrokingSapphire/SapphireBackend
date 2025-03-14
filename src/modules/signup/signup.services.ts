import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';
import { env } from '@app/env';
import transporter from '@app/services/email.service';
import smsService from '@app/services/sms.service';

abstract class OtpVerification {
    protected id: string; // Unique identifier (email or phone)
    protected otpExpiry: number = 10 * 60; // 10 minutes in seconds

    protected constructor(id: string) {
        this.id = id;
    }

    /**
     * Generates a random 6-digit OTP
     */
    private generateOtp(): string {
        // Generate a 6-digit OTP
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Stores OTP in Redis with expiration
     */
    protected async storeOtp(): Promise<string> {
        const otp = this.generateOtp();
        const key = `otp:${this.id}`;

        try {
            await redisClient.set(key, otp);
            await redisClient.expire(key, this.otpExpiry);
            return otp;
        } catch (error) {
            logger.error('Error storing OTP in Redis:', error);
            throw new Error('Failed to generate OTP');
        }
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
}

class EmailOtpVerification extends OtpVerification {
    constructor(email: string) {
        super(email);
    }

    /**
     * Send OTP to the user's email
     */
    public async sendOtp(): Promise<void> {
        try {
            const otp = await this.storeOtp();

            const mailOptions = {
                from: env.email.from,
                to: this.id,
                subject: 'Your Verification Code - Sapphire Broking',
                text: `Welcome to Sapphire Broking!
                
Your verification code is: ${otp}
This code will expire in 10 minutes. Do not share this code with anyone.
If you did not request this code, please ignore this email.
Regards,
The Sapphire Broking Team`,
            };

            await transporter.sendMail(mailOptions);
            logger.debug(`Sent OTP ${otp} to ${this.id}`);
        } catch (error) {
            logger.error(`Failed to send OTP to email ${this.id}:`, error);
            throw new Error('Failed to send OTP via email');
        }
    }
}

class PhoneOtpVerification extends OtpVerification {
    constructor(phoneNumber: string) {
        super(phoneNumber);
    }

    /**
     * Send OTP to the user's phone
     */
    public async sendOtp(): Promise<void> {
        try {
            const otp = await this.storeOtp();

            const message = `Welcome to Sapphire! Your OTP for signup is ${otp}. Do not share this OTP with anyone. It is valid for 10 minutes. - Sapphire Broking`;
            await smsService.sendSms(this.id, message, '1007898245699377543'); // FIXME: Remove raw template ID
            logger.debug(`Sent OTP ${otp} to ${this.id}`);
        } catch (error) {
            logger.error(`Failed to send OTP to phone ${this.id}:`, error);
            throw new Error('Failed to send OTP via SMS');
        }
    }
}

export { EmailOtpVerification, PhoneOtpVerification };
