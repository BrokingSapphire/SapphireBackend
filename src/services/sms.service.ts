import { env } from '@app/env';
import axios from 'axios';
import { InternalServerError } from '@app/apiError';
import templateContentMap, { SmsTemplateType } from './sms-templates/sms.types';
import logger from '@app/logger';

const BASE_URL = 'http://mobiglitz.com/vb';
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
    }

    /**
     * Send SMS
     */
    public async sendSms(mobile: string, message: string) {
        const url = `${BASE_URL}/apikey.php`;
        const response = await axios.get(url, {
            params: {
                apikey: this.apiKey,
                senderid: this.senderId,
                number: mobile,
                message,
            },
        });

        const data = response.data;
        if (data.error) {
            throw new InternalServerError(data.error);
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
            throw new InternalServerError('Invalid phone number format');
        }
        const templateContent = templateContentMap[templateType];
        if (!templateContent) {
            return false;
        }

        const message = this.replaceTemplateVariables(templateContent, variables);

        await this.sendSms(phoneNumber, message);
        return true;
    }

    /**
     * Send OTP SMS
     * @param phoneNumber Phone number to send to
     * @param otp OTP code
     * @param template Template type (signup, login, etc.)
     * @returns boolean indicating success
     */

    public async sendOtpSms(phoneNumber: string, otp: string, template: string): Promise<boolean> {
        const templateType = this.getTemplateTypeForOtp(template);
        if (!templateType) {
            logger.warn(`No matching SMS template found for context: ${template}`);
            return false;
        }

        return await this.sendTemplatedSms(phoneNumber, templateType, [otp]);
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
