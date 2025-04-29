export interface ProductDetail {
    prodName: string;
    prodAmount: number;
}

export interface PaymentDetails {
    prodDetails: ProductDetail[];
    amount: number;
    surchargeAmount?: number;
    totalAmount: number;
    custAccNo?: string;
    custAccIfsc?: string;
    clientCode?: string;
    txnCurrency: string;
    remarks?: string;
    signature?: string;
}

export interface CustomerDetails {
    custFirstName?: string;
    custLastName?: string;
    custEmail: string;
    custMobile?: string;
    billingInfo?: {
        custAddr1?: string;
        custAddr2?: string;
        custCity?: string;
        custState?: string;
        custCountry?: string;
        custZipCode?: string;
    };
}

export interface BankDetails {
    payeeVPA?: string;
    otsBankId?: string;
}

export interface PayModeSpecificData {
    subChannel: string[];
    bankDetails?: BankDetails;
    emiDetails?: any;
    multiProdDetails?: any;
    cardDetails?: any;
}

export interface PaymentRequest {
    payInstrument: {
        headDetails: {
            version: string;
            payMode: string;
            channel: string;
            api: string;
            stage: number;
            platform: string;
        };
        merchDetails: {
            merchId: number;
            userId?: string;
            password: string;
            merchTxnId: string;
            merchType?: string;
            mccCode?: number;
            merchTxnDate?: string;
        };
        payDetails: PaymentDetails;
        responseUrls: {
            returnUrl: string;
            cancelUrl?: string;
            notificationUrl?: string;
        };
        payModeSpecificData: PayModeSpecificData;
        extras?: {
            udf1?: string;
            udf2?: string;
            udf3?: string;
            udf4?: string;
            udf5?: string;
        };
        custDetails: CustomerDetails;
    };
}

export interface EncryptedRequest {
    merchId: number;
    encData: string;
}

export interface EncryptedResponse {
    merchId: number;
    encData: string;
}

export interface PaymentResponse {
    payInstrument: {
        merchDetails: {
            merchId: number;
            merchTxnId: string;
            merchTxnDate: string;
        };
        payDetails: {
            atomTxnId: number;
            prodDetails: ProductDetail[];
            amount: number;
            surchargeAmount: number;
            totalAmount: number;
            custAccNo?: string;
            clientCode?: string;
            txnCurrency: string;
            signature: string;
            txnInitDate: string;
            txnCompleteDate: string;
        };
        payModeSpecificData: {
            subChannel: string[];
            bankDetails?: {
                otsBankId?: number;
                bankTxnId?: string;
                otsBankName?: string;
            };
        };
        extras?: any;
        custDetails: CustomerDetails;
        responseDetails: {
            statusCode: string;
            message: string;
            description: string;
        };
    };
}

export interface TransactionStatus {
    statusCode: string;
    message: string;
    description: string;
}

export const StatusCodes = {
    SUCCESS: 'OTS0000',
    CANCEL: 'OTS0101',
    TIMEOUT: 'OTS0201',
    NODATA: 'OTS0401',
    INVALIDDATA: 'OTS0451',
    INVALIDDATA2: 'OTS0501',
    FAILED: 'OTS0600',
    INITIALIZED: 'OTS0301',
    INITIATED: 'OTS0351',
};
