// signup.services.ts

import redisClient from '@app/services/redis.service';
import logger from '@app/logger';
import { UnauthorizedError } from '@app/apiError';
import nodemailer from 'nodemailer';
import axios from 'axios';

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

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.id)) {
                logger.error(`Invalid email format: ${this.id}`);
                throw new Error('Invalid email format');
            }

            // Setup nodemailer
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER || 'noreply@sapphirebroking.com',
                    pass: process.env.EMAIL_PASSWORD || 'your-email-password',
                },
            });

            // Email content - simple text version only
            const mailOptions = {
                from: process.env.EMAIL_FROM || 'Sapphire Broking <noreply@sapphirebroking.com>',
                to: this.id,
                subject: 'Your Verification Code - Sapphire Broking',
                text: `Welcome to Sapphire Broking!
                
Your verification code is: ${otp}

This code will expire in 10 minutes. Do not share this code with anyone.

If you did not request this code, please ignore this email.

Regards,
The Sapphire Broking Team`,
            };

            // Send email
            await transporter.sendMail(mailOptions);
            logger.info(`OTP ${otp} sent via email to ${this.id}`);
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

            // Format mobile number (remove country code if needed)
            let mobileNumber = this.id;
            if (mobileNumber.startsWith('+91')) {
                mobileNumber = mobileNumber.substring(3);
            } else if (mobileNumber.startsWith('91') && mobileNumber.length > 10) {
                mobileNumber = mobileNumber.substring(2);
            }

            // Validate mobile number format
            const mobileRegex = /^[1-9]\d{9}$/;
            if (!mobileRegex.test(mobileNumber)) {
                logger.error(`Invalid mobile number format: ${mobileNumber}`);
                throw new Error('Invalid mobile number format');
            }

            // Construct message
            const message = `Welcome to Sapphire! Your OTP for signup is ${otp}. Do not share this OTP with anyone. It is valid for 10 minutes. - Sapphire Broking`;

            // Send SMS using the API
            const apiUrl = `http://mobiglitz.com/vb/apikey.php`;
            const params = new URLSearchParams({
                apikey: process.env.MOBIGLITZ_API_KEY || 'key',
                senderid: process.env.MOBIGLITZ_SENDER_ID || 'SPHRBK',
                number: mobileNumber,
                message: message,
                templateid: '1007898245699377543', // signup_otp template ID
            });

            const response = await axios.get(`${apiUrl}?${params.toString()}`);
            const result = response.data;

            if (!result || result.error) {
                logger.error(`Failed to send OTP via SMS: ${JSON.stringify(result)}`);
                throw new Error(result?.error || 'Failed to send SMS');
            }

            logger.info(`OTP ${otp} sent successfully to ${mobileNumber}`);
        } catch (error) {
            logger.error(`Failed to send OTP to phone ${this.id}:`, error);
            throw new Error('Failed to send OTP via SMS');
        }
    }
}

export { EmailOtpVerification, PhoneOtpVerification };
