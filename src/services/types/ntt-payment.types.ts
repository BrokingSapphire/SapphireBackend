export interface ProductDetail {
    prodName: string;
    prodAmount: string;
}

export interface PaymentDetails {
    prodDetails: ProductDetail[];
    amount: string;
    surchargeAmount: string;
    totalAmount: string;
    custAccNo: string | null;
    custAccIfsc: string | null;
    clientCode: string | null;
    txnCurrency: string;
    remarks: string | null;
    signature: string | null;
}

export interface CustomerDetails {
    custFirstName: string | null;
    custLastName: string | null;
    custEmail: string;
    custMobile: string | null;
    billingInfo: {
        custAddr1: string | null;
        custAddr2: string | null;
        custCity: string | null;
        custState: string | null;
        custCountry: string | null;
        custZipCode: string | null;
    } | null;
}

export interface BankDetails {
    payeeVPA?: string;
    otsBankId?: string;
}

export interface PayModeSpecificData {
    subChannel: string[];
    bankDetails: BankDetails | null;
    emiDetails: any | null;
    multiProdDetails: any | null;
    cardDetails: any | null;
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
            userId: string;
            password: string;
            merchTxnId: string;
            merchType: string | null;
            mccCode: number | null;
            merchTxnDate: string | null;
        };
        payDetails: PaymentDetails;
        responseUrls: {
            returnUrl: string;
            cancelUrl: string | null;
            notificationUrl: string | null;
        };
        payModeSpecificData: PayModeSpecificData;
        extras: {
            udf1: string | null;
            udf2: string | null;
            udf3: string | null;
            udf4: string | null;
            udf5: string | null;
        } | null;
        custDetails: CustomerDetails;
    };
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
            bankDetails: {
                otsBankId?: number;
                bankTxnId: string;
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
