import { JwtPayloadWithoutWildcard, ToDiscoUnion } from '@app/types';
import { CredentialsType } from '../common.types';

export type JwtType = JwtPayloadWithoutWildcard & {
    email: string;
    phone: string;
};

export enum CheckpointStep {
    PAN = 'pan',
    AADHAAR_URI = 'aadhaar_uri',
    AADHAAR = 'aadhaar',
    AADHAAR_MISMATCH_DETAILS = 'aadhaar_mismatch_details',
    INVESTMENT_SEGMENT = 'investment_segment',
    USER_DETAIL = 'user_detail',
    PERSONAL_DETAIL = 'personal_detail',
    OTHER_DETAIL = 'other_detail',
    BANK_VALIDATION_START = 'bank_validation_start',
    BANK_VALIDATION = 'bank_validation',
    SIGNATURE = 'signature',
    IPV = 'ipv',
    ADD_NOMINEES = 'add_nominees',
    PAN_VERIFICATION_RECORD = 'pan_verification_record',
    ESIGN_INITIALIZE = 'esign_initialize',
    ESIGN_COMPLETE = 'esign_complete',
    INCOME_PROOF = 'income_proof',
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

export enum Occupation {
    STUDENT = 'student',
    GOVT_SERVANT = 'govt servant',
    RETIRED = 'retired',
    PRIVATE_SECTOR = 'private sector',
    AGRICULTURALIST = 'agriculturalist',
    SELF_EMPLOYED = 'self employed',
    HOUSEWIFE = 'housewife',
    OTHER = 'other',
}

export enum AccountType {
    SAVINGS = 'savings',
    CURRENT = 'current',
}

export enum NomineeRelation {
    FATHER = 'Father',
    MOTHER = 'Mother',
    SON = 'Son',
    DAUGHTER = 'Daughter',
    SISTER = 'Sister',
    BROTHER = 'Brother',
    SPOUSE = 'Spouse',
    OTHER = 'Other',
}

export enum IncomeProofType {
    BANK_STATEMENT = 'bank_statement_6m_10k',
    SALARY_SLIP = 'salary_slip_15k_monthly',
    FORM_16 = 'form_16_120k_annual',
    NET_WORTH_CERTIFICATE = 'net_worth_certificate_10l',
    DEMAT_STATUS_HOLDINGS = 'demat_statement_10k_holdings',
}

export type RequestOtpType = ToDiscoUnion<{
    [CredentialsType.EMAIL]: {
        email: string;
    };
    [CredentialsType.PHONE]: {
        email: string;
        phone: string;
    };
}>;

export type VerifyOtpType = ToDiscoUnion<{
    [CredentialsType.EMAIL]: {
        email: string;
        otp: string;
    };
    [CredentialsType.PHONE]: {
        email: string;
        phone: string;
        otp: string;
    };
}>;

export type ResendOtpType = RequestOtpType;

export type GetCheckpointType = {
    step: CheckpointStep;
};

export type PostCheckpointType = ToDiscoUnion<
    {
        [CheckpointStep.PAN]: {
            pan_number: string;
        };
        [CheckpointStep.AADHAAR_URI]: {
            redirect: string;
        };
        [CheckpointStep.AADHAAR]: {};
        [CheckpointStep.AADHAAR_MISMATCH_DETAILS]: {
            full_name: string;
            dob: string;
        };
        [CheckpointStep.INVESTMENT_SEGMENT]: {
            segments: InvestmentSegment[];
        };
        [CheckpointStep.USER_DETAIL]: {
            father_spouse_name: string;
            mother_name: string;
            maiden_name?: string;
        };
        [CheckpointStep.PERSONAL_DETAIL]: {
            marital_status: MaritalStatus;
            annual_income: AnnualIncome;
            trading_exp: TradingExperience;
            acc_settlement: AccountSettlement;
        };
        [CheckpointStep.OTHER_DETAIL]: {
            occupation: Occupation;
            politically_exposed: boolean;
        };
        [CheckpointStep.BANK_VALIDATION_START]: {
            validation_type: ValidationType;
        };
        [CheckpointStep.BANK_VALIDATION]: ToDiscoUnion<
            {
                [ValidationType.BANK]: {
                    bank: {
                        account_type: AccountType;
                        account_number: string;
                        ifsc_code: string;
                    };
                };
                [ValidationType.UPI]: {};
            },
            'validation_type'
        >;
        [CheckpointStep.SIGNATURE]: {};
        [CheckpointStep.IPV]: {};
        [CheckpointStep.INCOME_PROOF]: {
            income_proof_type: IncomeProofType;
        };
        [CheckpointStep.ADD_NOMINEES]: {
            nominees: {
                name: string;
                gov_id: string;
                relation: NomineeRelation;
                share: number;
            }[];
        };
        [CheckpointStep.PAN_VERIFICATION_RECORD]: {};
        [CheckpointStep.ESIGN_INITIALIZE]: {
            redirect_url: string;
        };
        [CheckpointStep.ESIGN_COMPLETE]: {};
    },
    'step'
>;

export type SetupMpinType = {
    mpin: string;
    confirm_mpin: string;
};

export type SetupPasswordType = {
    password: string;
    confirm_password: string;
};

export type UIDParams = {
    uid: string;
};
