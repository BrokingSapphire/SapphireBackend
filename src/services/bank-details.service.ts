import axios from 'axios';

export interface BankDetails {
    BANK: string;
    IFSC: string;
    BRANCH: string;
    ADDRESS: string;
    CONTACT: string;
    CITY: string;
    DISTRICT: string;
    STATE: string;
    RTGS: boolean;
    BANKCODE: string;
}

/**
 * Service for interacting with bank details APIs
 */
class BankDetailsService {
    async getBankDetailsByIFSC(code: string): Promise<BankDetails | null> {
        const response = await axios.get<BankDetails>(`https://ifsc.razorpay.com/${code}`);

        if (response.status === 200) {
            return response.data;
        }

        return null;
    }

    getBankCodeFromIFSC(ifsc: string): string | null {
        if (!ifsc || ifsc.length < 4) {
            return null;
        }

        return ifsc.substring(0, 4).toUpperCase();
    }
}

export default new BankDetailsService();
