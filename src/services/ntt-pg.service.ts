import axios from 'axios';
import { decrypt, encrypt, generateSignature } from '@app/utils/atom-crypto';
import { env } from '@app/env';
import {
    CustomerDetails,
    PaymentDetails,
    PaymentRequest,
    PaymentResponse,
    PayModeSpecificData,
} from '@app/services/types/ntt-payment.types';
import * as querystring from 'node:querystring';
import { NonNullableFields } from '@app/types';

const PAYMENT_URL = 'https://paynetzuat.atomtech.in/ots/payment/txn';

export class PaymentService {
    constructor(
        private readonly returnUrl: string,
        private readonly cancelUrl: string | null = null,
        private readonly notificationUrl: string | null = null,
    ) {}

    async createPaymentRequest(
        amount: string,
        merchTxnId: string,
        clientId: string,
        customerDetails: Omit<CustomerDetails, 'billingInfo'>,
        accountDetails: NonNullableFields<Pick<PaymentDetails, 'custAccNo' | 'custAccIfsc'>>,
        payMode: 'UP' | 'NB',
    ) {
        const payModeSpecificData: PayModeSpecificData =
            payMode === 'UP'
                ? {
                      subChannel: ['UP'],
                      bankDetails: { payeeVPA: env.ntt.uatVpa },
                      emiDetails: null,
                      multiProdDetails: null,
                      cardDetails: null,
                  }
                : {
                      subChannel: ['NB'],
                      bankDetails: { otsBankId: env.ntt.uatBankId },
                      emiDetails: null,
                      multiProdDetails: null,
                      cardDetails: null,
                  };

        const signature = generateSignature(env.ntt.hashRequestKey, [
            env.ntt.userId,
            env.ntt.transactionPassword,
            merchTxnId,
            'SL',
            amount,
            'INR',
            '1',
        ]);

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
                    userId: '',
                    password: env.ntt.transactionPassword,
                    merchTxnId,
                    merchType: 'M',
                    mccCode: Number(env.ntt.mccCode),
                    merchTxnDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
                },
                payDetails: {
                    prodDetails: [{ prodName: env.ntt.productId, prodAmount: amount }],
                    amount,
                    surchargeAmount: '0.00',
                    totalAmount: amount,
                    custAccNo: accountDetails.custAccNo,
                    custAccIfsc: accountDetails.custAccIfsc,
                    txnCurrency: 'INR',
                    clientCode: clientId,
                    remarks: null,
                    signature,
                },
                responseUrls: {
                    returnUrl: this.returnUrl,
                    cancelUrl: this.cancelUrl ?? null,
                    notificationUrl: this.notificationUrl ?? null,
                },
                payModeSpecificData,
                extras: {
                    udf1: null,
                    udf2: null,
                    udf3: null,
                    udf4: null,
                    udf5: null,
                },
                custDetails: {
                    ...customerDetails,
                    billingInfo: null,
                },
            },
        };

        return this.processPaymentRequest(paymentRequest);
    }

    private async processPaymentRequest(paymentRequest: PaymentRequest) {
        try {
            const encryptedRequest = {
                merchId: env.ntt.userId,
                encData: encrypt(JSON.stringify(paymentRequest), env.ntt.aesRequestKey),
            };

            return await axios(PAYMENT_URL, {
                method: 'GET',
                params: encryptedRequest,
            });
        } catch (error) {
            throw new Error(`Payment request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    processResponse(data: string): [PaymentResponse, boolean] {
        const formData = querystring.parse(data);

        if (formData.merchId !== env.ntt.userId) {
            throw new Error(`${formData.merchId} is invalid.`);
        }

        return this.decryptAndValidateResponse(formData.encData as string);
    }

    decryptAndValidateResponse(encData: string): [PaymentResponse, boolean] {
        const resp: PaymentResponse = JSON.parse(decrypt(encData, env.ntt.aesResponseKey));
        const isValid = this.validateResponseSignature(resp);
        return [resp, isValid];
    }

    private validateResponseSignature(response: PaymentResponse): boolean {
        const { merchDetails, payDetails, payModeSpecificData, responseDetails } = response.payInstrument;

        if (!payDetails.signature || !payDetails.atomTxnId) return false;

        const expectedSignature = generateSignature(env.ntt.hashResponseKey, [
            merchDetails.merchId.toString(),
            payDetails.atomTxnId.toString(),
            merchDetails.merchTxnId,
            payDetails.totalAmount.toString(),
            responseDetails.statusCode,
            payModeSpecificData.subChannel[0],
            payModeSpecificData.bankDetails?.bankTxnId || '',
        ]);

        return expectedSignature === payDetails.signature;
    }
}
