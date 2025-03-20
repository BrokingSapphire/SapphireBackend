import { env } from '@app/env';
import axios from 'axios';
import { InternalServerError } from '@app/apiError';

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
    public async sendSms(mobile: string, message: string, templateId: string) {
        const url = `${BASE_URL}/apikey.php`;
        const response = await axios.get(url, {
            params: {
                apikey: this.apiKey,
                senderid: this.senderId,
                number: mobile,
                message,
                templateid: templateId,
            },
        });

        const data = response.data;
        if (data.error) {
            throw new InternalServerError(data.error);
        }
    }
}

export default new SmsService();
