import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';

abstract class OtpVerification {
    protected id: string; // Unique identifier (email or phone)
    protected otpExpiry: number = 10 * 60; // 10 minutes in seconds

    constructor(id: string) {
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
    public async verifyOtp(inputOtp: string): Promise<boolean> {
        const key = `otp:${this.id}`;

        try {
            const storedOtp = await redisClient.get(key);

            if (storedOtp === inputOtp) {
                // Delete the OTP after successful verification to prevent reuse
                await redisClient.del(key);
                logger.info(`OTP verified successfully for ${this.id}`);
                return true;
            } else {
                logger.error(`Invalid OTP for ${this.id}`);
                throw new UnauthorizedError('Invalid OTP provided');
            }
        } catch (error) {
            logger.error('Error verifying OTP:', error);
            if (error instanceof UnauthorizedError) {
                throw error;
            }
            throw new Error('Failed to verify OTP');
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
            logger.error('Error checking OTP existence:', error);
            return false;
        }
    }

    /**
     * Get remaining time before OTP expires (in seconds)
     */
    public async getOtpTtl(): Promise<number> {
        const key = `otp:${this.id}`;
        try {
            const ttl = await redisClient.ttl(key);
            return ttl;
        } catch (error) {
            logger.error('Error getting OTP TTL:', error);
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
            // Logic to send the OTP to the user's email
            logger.info(`Sending OTP ${otp} to ${this.id}`);
            // Here you would integrate with an email service to send the OTP
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
            // Logic to send the OTP to the user's phone
            logger.info(`Sending OTP ${otp} to ${this.id}`);
            // Here you would integrate with an SMS service to send the OTP
        } catch (error) {
            logger.error(`Failed to send OTP to phone ${this.id}:`, error);
            throw new Error('Failed to send OTP via SMS');
        }
    }
}

export { EmailOtpVerification, PhoneOtpVerification };
