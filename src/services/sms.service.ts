import { env } from '@app/env';
import logger from '@app/logger';
import axios from 'axios';

interface SmsTemplate {
    id: string;
    name: string;
    header: string;
    type: string;
    content: string;
}

interface SmsResponse {
    success: boolean;
    data?: any;
    error?: string;
}

const BASE_URL = 'http://mobiglitz.com/vb';

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
     * Format mobile number by removing special chars and country code
     */
    private formatMobile(mobile: string): string {
        let formatted = mobile.replace(/[\s\-\+]/g, '');
        if (formatted.length > 10) {
            formatted = formatted.substring(2);
        }
        return formatted;
    }

    /**
     * Validate mobile number format
     */
    private isValidMobile(mobile: string): boolean {
        return /^[1-9]\d{9}$/.test(mobile);
    }

    /**
     * Send SMS
     */
    public async sendSms(mobile: string, message: string, templateId: string): Promise<SmsResponse> {
        try {
            const formattedMobile = this.formatMobile(mobile);

            if (!this.isValidMobile(formattedMobile)) {
                return { success: false, error: 'Invalid mobile number' };
            }

            const url = `${BASE_URL}/apikey.php`;
            const response = await axios.get(url, {
                params: {
                    apikey: this.apiKey,
                    senderid: this.senderId,
                    number: formattedMobile,
                    message,
                    templateid: templateId,
                },
            });

            const data = response.data;
            if (data && !data.error) {
                return { success: true, data };
            }

            return { success: false, error: data.error || 'SMS sending failed' };
        } catch (error) {
            logger.error('SMS Error:', error);
            return { success: false, error: 'Failed to send SMS' };
        }
    }
}

export default new SmsService();
