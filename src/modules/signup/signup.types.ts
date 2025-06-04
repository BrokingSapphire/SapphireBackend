import { DefaultResponseData, JwtPayloadWithoutWildcard } from '@app/types';
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
    ACCOUNT_DETAIL = 'account_detail',
    BANK_VALIDATION_START = 'bank_validation_start',
    BANK_VALIDATION = 'bank_validation',
    SIGNATURE = 'signature',
    IPV = 'ipv',
    ADD_NOMINEES = 'add_nominees',
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

export type RequestOtpType =
    | {
          type: CredentialsType.EMAIL;
          email: string;
      }
    | {
          type: CredentialsType.PHONE;
          email: string;
          phone: string;
      };

export type VerifyOtpType =
    | {
          type: CredentialsType.EMAIL;
          email: string;
          otp: string;
      }
    | {
          type: CredentialsType.PHONE;
          email: string;
          phone: string;
          otp: string;
      };

export type ResendOtpType = RequestOtpType;

export type GetCheckpointType = {
    step: CheckpointStep;
};

export type PostCheckpointType =
    | {
          step: CheckpointStep.PAN;
          pan_number: string;
      }
    | {
          step: CheckpointStep.AADHAAR_URI;
          redirect: string;
      }
    | {
          step: CheckpointStep.AADHAAR;
      }
    | {
          step: CheckpointStep.AADHAAR_MISMATCH_DETAILS;
          full_name: string;
          dob: string;
      }
    | {
          step: CheckpointStep.INVESTMENT_SEGMENT;
          segments: InvestmentSegment[];
      }
    | {
          step: CheckpointStep.USER_DETAIL;
          father_name: string;
          mother_name: string;
      }
    | {
          step: CheckpointStep.PERSONAL_DETAIL;
          marital_status: MaritalStatus;
          annual_income: AnnualIncome;
          trading_exp: TradingExperience;
          acc_settlement: AccountSettlement;
      }
    | {
          step: CheckpointStep.OTHER_DETAIL;
          occupation: Occupation;
          politically_exposed: boolean;
      }
    | {
          step: CheckpointStep.BANK_VALIDATION_START;
          validation_type: ValidationType;
      }
    | {
          step: CheckpointStep.BANK_VALIDATION;
          validation_type: ValidationType.UPI;
      }
    | {
          step: CheckpointStep.BANK_VALIDATION;
          validation_type: ValidationType.BANK;
          bank: {
              account_number: string;
              ifsc_code: string;
              account_type: AccountType;
          };
      }
    | {
          step: CheckpointStep.SIGNATURE;
      }
    | {
          step: CheckpointStep.IPV;
      }
    | {
          step: CheckpointStep.INCOME_PROOF;
      }
    | {
          step: CheckpointStep.ADD_NOMINEES;
          nominees: {
              name: string;
              gov_id: string;
              relation: NomineeRelation;
              share: number;
          }[];
      };

export type UIDParams = {
    uid: string;
};
