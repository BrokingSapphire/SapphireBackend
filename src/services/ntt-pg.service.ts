import { decrypt, encrypt, generateSignature } from '@app/utils/atom-crypto';
import { env } from '@app/env';
import {
    CustomerDetails,
    PaymentDetails,
    PaymentRequest,
    PaymentResponse,
} from '@app/services/types/ntt-payment.types';
import * as querystring from 'node:querystring';
import { NonNullableFields } from '@app/types';

const PAYMENT_URL = 'https://paynetzuat.atomtech.in/ots/payment/txn';
const PAY_MODE = 'SS';
const CURRENCY = 'INR';
const VERSION = 'OTSv1.1';
const CHANNEL = 'ECOMM';
const API = 'SALE';
const STAGE = 1;

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
        payType: 'UP' | 'NB',
        payVPA?: string,
    ) {
        const signature = generateSignature(env.ntt.hashRequestKey, [
            env.ntt.userId,
            env.ntt.transactionPassword,
            merchTxnId,
            PAY_MODE,
            amount,
            CURRENCY,
            STAGE.toString(),
        ]);

        const paymentRequest: PaymentRequest = {
            payInstrument: {
                headDetails: {
                    version: VERSION,
                    payMode: PAY_MODE,
                    channel: CHANNEL,
                    api: API,
                    stage: STAGE,
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
                    txnCurrency: CURRENCY,
                    clientCode: clientId,
                    remarks: null,
                    signature,
                },
                responseUrls: {
                    returnUrl: this.returnUrl,
                    cancelUrl: this.cancelUrl ?? null,
                    notificationUrl: this.notificationUrl ?? null,
                },
                payModeSpecificData: {
                    subChannel: [payType],
                    bankDetails: {
                        otsBankId: payType === 'NB' ? env.ntt.uatBankId : undefined,
                        payeeVPA: payType === 'UP' ? payVPA! : undefined,
                    },
                    emiDetails: null,
                    multiProdDetails: null,
                    cardDetails: null,
                },
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

        return this.getPaymentUrl(paymentRequest);
    }

    private async getPaymentUrl(paymentRequest: PaymentRequest) {
        const encryptedRequest = {
            merchId: env.ntt.userId,
            encData: encrypt(JSON.stringify(paymentRequest), env.ntt.aesRequestKey),
        };

        return `${PAYMENT_URL}?${querystring.stringify(encryptedRequest)}`;
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
            payDetails.totalAmount.toFixed(2),
            responseDetails.statusCode,
            payModeSpecificData.subChannel[0],
            payModeSpecificData.bankDetails.bankTxnId,
        ]);

        return expectedSignature === payDetails.signature;
    }
}
