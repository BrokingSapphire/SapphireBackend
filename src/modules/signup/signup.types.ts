import { JwtPayloadWithoutWildcard } from '@app/types';

export type JwtType = JwtPayloadWithoutWildcard & {
    email: string;
    phone: string;
}

export enum CheckpointStep {
    PAN = 'pan',
    AADHAAR_URI = 'aadhaar_uri',
    AADHAAR = 'aadhaar',
    INVESTMENT_SEGMENT = 'investment_segment',
    USER_DETAIL = 'user_detail',
    ACCOUNT_DETAIL = 'account_detail',
    OCCUPATION = 'occupation',
    BANK_VALIDATION_START = 'bank_validation_start',
    BANK_VALIDATION = 'bank_validation',
    SIGNATURE = 'signature',
    IPV = 'ipv',
    ADD_NOMINEES = 'add_nominees',
}

export enum InvestmentSegment {
    CASH = 'Cash',
    COMMODITY = 'Commodity',
    CURRENCY = 'Currency',
    DEBT = 'Debt',
    F_AND_O = 'F&O',
}

export enum MaritalStatus {
    SINGLE = 'Single',
    MARRIED = 'Married',
    DIVORCED = 'Divorced',
}

export enum AnnualIncome {
    LE_1_LAKH = 'le_1_Lakh',
    LAKH_1_5 = '1_5_Lakh',
    LAKH_5_10 = '5_10_Lakh',
    LAKH_10_25 = '10_25_Lakh',
    LAKH_25_1_CR = '25_1_Cr',
    GE_1_CR = 'Ge_1_Cr',
}

export enum TradingExperience {
    ONE_YEAR = '1',
    ONE_TO_FIVE = '1-5',
    FIVE_TO_TEN = '5-10',
    TEN_PLUS = '10',
}

export enum AccountSettlement {
    MONTHLY = 'Monthly',
    QUARTERLY = 'Quarterly',
}

export enum ValidationType {
    BANK = 'bank',
    UPI = 'upi',
}