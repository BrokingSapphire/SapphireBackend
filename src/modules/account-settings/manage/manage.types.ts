export enum DematStatus {
    ACTIVE = 'active',
    FROZEN = 'frozen',
    SUSPENDED = 'suspended',
    UNDER_REVIEW = 'under_review',
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
