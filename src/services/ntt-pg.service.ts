import axios from 'axios';
import { decrypt, encrypt, generateSignature } from '@app/utils/atom-crypto';
import logger from '@app/logger';
import { env } from '@app/env';
import {
    CustomerDetails,
    PaymentRequest,
    PaymentResponse,
    PayModeSpecificData,
    TransactionStatus,
} from '@app/services/types/ntt-payment.types';

const PAYMENT_URL = 'https://paynetzuat.atomtech.in/ots/payment/txn';

export class PaymentService {
    constructor(
        private readonly returnUrl: string,
        private readonly cancelUrl: string | null = null,
        private readonly notificationUrl: string | null = null,
    ) {}

    async createPaymentRequest(
        amount: number,
        merchTxnId: string,
        clientId: string,
        customerDetails: CustomerDetails,
        payMode: 'UP' | 'NB',
    ) {
        const payModeSpecificData: PayModeSpecificData =
            payMode === 'UP'
                ? { subChannel: ['UP'], bankDetails: { payeeVPA: env.ntt.uatVpa } }
                : { subChannel: ['NB'], bankDetails: { otsBankId: env.ntt.uatBankId } };

        const paymentRequest: PaymentRequest = {
            payInstrument: {
                headDetails: {
                    version: 'OTSv1.1',
                    payMode: 'SL',
                    channel: 'ECOMM',
                    api: 'SALE',
                    stage: 1,
                    platform: 'WEB',
                },
                merchDetails: {
                    merchId: Number(env.ntt.userId),
                    password: env.ntt.transactionPassword,
                    merchTxnId,
                    merchType: 'MEMBER',
                    mccCode: Number(env.ntt.mccCode),
                    merchTxnDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
                },
                payDetails: {
                    prodDetails: [{ prodName: env.ntt.productId, prodAmount: amount }],
                    amount,
                    totalAmount: amount,
                    txnCurrency: 'INR',
                    clientCode: clientId,
                    signature: generateSignature(env.ntt.hashRequestKey, [
                        env.ntt.userId,
                        env.ntt.transactionPassword,
                        merchTxnId,
                        'SL',
                        amount.toString(),
                        'INR',
                        '1',
                    ]),
                },
                responseUrls: {
                    returnUrl: this.returnUrl,
                    cancelUrl: this.cancelUrl ?? undefined,
                    notificationUrl: this.notificationUrl ?? undefined,
                },
                payModeSpecificData,
                custDetails: customerDetails,
            },
        };

        return this.processPaymentRequest(paymentRequest);
    }

    private async processPaymentRequest(paymentRequest: PaymentRequest) {
        try {
            const encryptedRequest = {
                merchId: Number(env.ntt.userId),
                encData: encrypt(JSON.stringify(paymentRequest), env.ntt.aesRequestKey),
            };

            return await axios(PAYMENT_URL, {
                method: 'POST',
                params: encryptedRequest,
            });
        } catch (error) {
            throw new Error(`Payment request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    decryptAndValidateResponse(encData: string): [PaymentResponse, boolean] {
        const resp: PaymentResponse = JSON.parse(decrypt(encData, env.ntt.aesResponseKey));
        const isValid = this.validateResponseSignature(resp);
        return [resp, isValid];
    }

    private validateResponseSignature(response: PaymentResponse): boolean {
        const { merchDetails, payDetails, payModeSpecificData, responseDetails } = response.payInstrument;

        if (!payDetails.signature || !payDetails.atomTxnId) return true;

        const isValid =
            generateSignature(env.ntt.aesResponseKey, [
                merchDetails.merchId.toString(),
                payDetails.atomTxnId.toString(),
                merchDetails.merchTxnId,
                payDetails.amount.toString(),
                responseDetails.statusCode,
                payModeSpecificData.subChannel[0],
                payModeSpecificData.bankDetails?.bankTxnId || '',
            ]) === payDetails.signature;

        return isValid;
    }

    getStatusDescription(statusCode: string) {
        const statusMap: Record<string, string> = {
            OTS0000: 'TRANSACTION IS SUCCESSFUL',
            OTS0101: 'TRANSACTION IS CANCELLED BY USER ON PAYMENT PAGE',
            OTS0201: 'TRANSACTION IS TIMEOUT',
            OTS0401: 'NO DATA',
            OTS0451: 'INVALID DATA',
            OTS0501: 'INVALID DATA',
            OTS0600: 'TRANSACTION IS FAILED',
            OTS0301: 'TRANSACTION IS INITIALIZED',
            OTS0351: 'TRANSACTION IS INITIATED',
        };
        return statusMap[statusCode] || 'Unknown status code';
    }
}
