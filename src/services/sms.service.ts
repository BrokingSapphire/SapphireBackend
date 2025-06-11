import { env } from '@app/env';
import axios from 'axios';
import { InternalServerError } from '@app/apiError';
import templateContentMap, { SmsTemplateType } from './sms-templates/sms.types';
import logger from '@app/logger';

const BASE_URL = 'https://mobiglitz.com/vb'; // changed from http to https
export const PHONE_REGEX: RegExp = /^\d{10}$/;

/**
 * Service for handling SMS notifications and OTP functionality
 */
export class SmsService {
    private readonly apiKey: string;
    private readonly senderId: string;

    constructor() {
        this.apiKey = env.sms.apiKey;
        this.senderId = env.sms.senderId.substring(0, 6).toUpperCase();

        logger.info(`SMS Service initialized with sender ID: ${this.senderId}`);

        // Log configuration (without exposing sensitive data)
        if (!this.apiKey) {
            logger.warn('SMS API key not configured');
        }
    }

    /**
     * Send SMS
     */
    public async sendSms(mobile: string, message: string) {
        if (!PHONE_REGEX.test(mobile)) {
            logger.error(`Invalid phone number format: ${mobile}`);
            throw new InternalServerError('Invalid phone number format');
        }

        const url = `${BASE_URL}/apikey.php`;

        try {
            logger.debug(`Making SMS API request to: ${url}`);

            const response = await axios.get(url, {
                params: {
                    apikey: this.apiKey,
                    senderid: this.senderId,
                    number: mobile,
                    message,
                },
            });

            const data = response.data;

            logger.info(`Complete SMS API response for ${mobile}:`, {
                status: response.status,
                data,
                messageId: data.data?.messageid,
                description: data.description,
            });

            logger.info(`SMS sent successfully to: ${mobile} - MessageID: ${data.data?.messageid || 'N/A'}`);
            return data;
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                logger.error(`SMS API timeout for ${mobile}`);
                throw new InternalServerError('SMS service timeout');
            } else if (error.response) {
                logger.error(`SMS API HTTP error for ${mobile}:`, {
                    status: error.response.status,
                    data: error.response.data,
                });
                throw new InternalServerError(`SMS service error: ${error.response.status}`);
            } else {
                logger.error(`SMS API network error for ${mobile}:`, error.message);
                throw new InternalServerError('SMS service unavailable');
            }
        }
    }

    /**
     * Send SMS using a template
     * @param phoneNumber Phone number to send to
     * @param templateType Template type to use
     * @param variables Variables to replace in the template
     */
    public async sendTemplatedSms(
        phoneNumber: string,
        templateType: SmsTemplateType,
        variables: string[],
    ): Promise<boolean> {
        if (!PHONE_REGEX.test(phoneNumber)) {
            logger.error(`Invalid phone number format for templated SMS: ${phoneNumber}`);
            throw new InternalServerError('Invalid phone number format');
        }

        const templateContent = templateContentMap[templateType];
        if (!templateContent) {
            logger.error(`Template not found: ${templateType}`);
            return false;
        }

        const message = this.replaceTemplateVariables(templateContent, variables);

        try {
            await this.sendSms(phoneNumber, message);
            logger.info(`Templated SMS sent successfully to: ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send templated SMS to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Send OTP SMS
     * @param phoneNumber Phone number to send to
     * @param otp OTP code
     * @param template Template type (signup, login, etc.)
     * @returns boolean indicating success
     */
    public async sendOtpSms(phoneNumber: string, otp: string, template: string): Promise<boolean> {
        logger.info(`Sending OTP SMS to: ${phoneNumber}, template context: ${template}`);
        logger.debug(`OTP value: ${otp}`);

        const templateType = this.getTemplateTypeForOtp(template);
        if (!templateType) {
            logger.warn(`No matching SMS template found for context: ${template}`);
            return false;
        }

        logger.debug(`Mapped template context '${template}' to SMS template: ${templateType}`);

        try {
            const result = await this.sendTemplatedSms(phoneNumber, templateType, [otp]);
            logger.info(`OTP SMS ${result ? 'sent successfully' : 'failed'} to: ${phoneNumber}`);
            return result;
        } catch (error) {
            logger.error(`Failed to send OTP SMS to ${phoneNumber}:`, error);
            throw error;
        }
    }

    private getTemplateTypeForOtp(context: string): SmsTemplateType | null {
        switch (context) {
            case 'signup':
                return SmsTemplateType.SAPPHIRE_SIGNUP;
            case 'login':
                return SmsTemplateType.TERMINAL_LOGIN_OTP;
            case 'forgot-password':
            case 'reset-password':
                return SmsTemplateType.TERMINAL_PWD_RESET_OTP;
            case '2fa':
                return SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP;
            default:
                return null;
        }
    }
    private replaceTemplateVariables(template: string, variables: string[]): string {
        let result = template;
        for (const value of variables) {
            result = result.replace('{#var#}', value);
        }
        return result;
    }
}

export default new SmsService();
