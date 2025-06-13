import { AccountType } from '@app/modules/signup/signup.types';

export enum DematStatus {
    ACTIVE = 'active',
    FROZEN = 'frozen',
    SUSPENDED = 'suspended',
    UNDER_REVIEW = 'under_review',
    PROCESSING = 'processing',
}

export enum DematAction {
    FREEZE = 'freeze',
    UNFREEZE = 'unfreeze',
}

export enum FundsSettlementFrequency {
    THIRTY_DAYS = '30_days',
    NINETY_DAYS = '90_days',
    BILL_TO_BILL = 'bill_to_bill',
}

export type InitiateSettlementFrequencyChangeRequestType = {
    frequency: FundsSettlementFrequency;
};

// Step 2: Verify OTP
export type VerifySettlementFrequencyChangeRequestType = {
    sessionId: string;
    otp: string;
    frequency: FundsSettlementFrequency;
};

// Step 3: Resend OTP
export type ResendSettlementFrequencyOtpRequestType = {
    sessionId: string;
};

export interface SegmentActivationSettings {
    cashMutualFunds?: boolean;
    futuresAndOptions?: boolean;
    commodityDerivatives?: boolean;
    debt?: boolean;
    currency?: boolean;
}

export interface AddBankAccountRequest {
    account_no: string;
    ifsc_code: string;
    account_type: AccountType;
}

export interface RemoveBankRequest {
    bankAccountId: number;
}

export interface FreezeDematRequest {
    action: DematAction;
    reason?: string;
}

export interface UpdateSettlementFrequencyRequest {
    frequency: FundsSettlementFrequency;
}
