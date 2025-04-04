// src/interfaces/db.interface.ts
import { ColumnType, Generated } from 'kysely';

// Import the types from the generated schema
import {
  UserAnnualIncome,
  UserMaritalStatus,
  UserTradingExp,
  Timestamp
} from './db.generated';

// Define compliance status type
export type ComplianceStatus = 'pending' | 'approved' | 'rejected';
export type ComplianceAction = 'approval' | 'rejection' | 'review';
export type VerificationStatus = 'verified' | 'failed' | 'pending';
export type ValidationStatus = 'success' | 'failed' | 'pending';

// Define interfaces for database tables
export interface UserNameTable {
  id: Generated<number>;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  full_name: Generated<string | null>;
}

export interface PhoneNumberTable {
  id: Generated<number>;
  phone: string;
}

export interface PanNumberTable {
  id: Generated<number>;
  pan: string;
  is_verified: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AadharNumberTable {
  id: Generated<number>;
  aadhar: string;
  is_verified: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SignupCheckpointsTable {
  id: Generated<number>;
  email: string | null;
  name: number | null; // Foreign key to user_name.id
  phone_id: number;
  pan_id: number | null; // Foreign key to pan_number.id
  aadhaar_id: number | null; // Foreign key to aadhar_number.id
  dob: Timestamp | null;
  marital_status: UserMaritalStatus | null;
  occupation: string | null;
  annual_income: UserAnnualIncome | null;
  trading_exp: UserTradingExp | null;
  is_politically_exposed: boolean | null;
  compliance_status: ComplianceStatus | null;
  created_at: Date
  updated_at: Date
}

export interface PanVerificationDetailsTable {
  id: Generated<number>;
  pan_id: number; // Foreign key to pan_number.id
  name_as_per_pan: string;
  verification_method: string;
  verification_status: VerificationStatus;
  verification_timestamp: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AadhaarVerificationDetailsTable {
  id: Generated<number>;
  aadhar_id: number; // Foreign key to aadhar_number.id
  name_as_per_aadhaar: string;
  address: string | null;
  gender: string | null;
  verification_method: string;
  verification_status: VerificationStatus;
  verification_timestamp: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BankAccountTable {
  id: Generated<number>;
  account_no: string;
  micr_code: string | null;
  ifsc_code: string;
  account_holder_name: string;
  bank_name: string;
  verification_status: VerificationStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BankToCheckpointTable {
  id: Generated<number>;
  checkpoint_id: number; // Foreign key to signup_checkpoints.id
  bank_account_id: number; // Foreign key to bank_account.id
  is_primary: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BankValidationDetailsTable {
  id: Generated<number>;
  bank_account_id: number; // Foreign key to bank_account.id
  validation_method: string;
  validation_status: ValidationStatus;
  validation_timestamp: Timestamp;
  remarks: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface NomineesTable {
  id: Generated<number>;
  name: number; // Foreign key to user_name.id
  relationship: string;
  share: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface NomineesToCheckpointTable {
  id: Generated<number>;
  checkpoint_id: number; // Foreign key to signup_checkpoints.id
  nominees_id: number; // Foreign key to nominees.id
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ComplianceOfficersTable {
  id: Generated<number>;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ComplianceHistoryTable {
  id: Generated<number>;
  checkpoint_id: number; // Foreign key to signup_checkpoints.id
  officer_id: number; // Foreign key to compliance_officers.id
  action: ComplianceAction;
  status: ComplianceStatus;
  reason?: string;
  notes?: string;
  created_at: Timestamp;
}

// Define the Database interface that combines all tables
export interface Database {
  user_name: UserNameTable;
  phone_number: PhoneNumberTable;
  pan_number: PanNumberTable;
  aadhar_number: AadharNumberTable;
  signup_checkpoints: SignupCheckpointsTable;
  pan_verification_details: PanVerificationDetailsTable;
  aadhaar_verification_details: AadhaarVerificationDetailsTable;
  bank_account: BankAccountTable;
  bank_to_checkpoint: BankToCheckpointTable;
  bank_validation_details: BankValidationDetailsTable;
  nominees: NomineesTable;
  nominees_to_checkpoint: NomineesToCheckpointTable;
  compliance_officers: ComplianceOfficersTable;
  compliance_history: ComplianceHistoryTable;
}

// Model interfaces for query results
export interface PendingVerificationModel {
  checkpoint_id: number;
  email: string | null;
  dob: Date | string | null;
  submitted_at: Date | string;
  compliance_status: ComplianceStatus | null;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  phone: string;
}

export interface CheckpointDetailModel {
  checkpoint_id: number;
  email: string | null;
  dob: Date | string | null;
  marital_status: UserMaritalStatus | null;
  occupation: string | null;
  annual_income: UserAnnualIncome | null;
  trading_exp: UserTradingExp | null;
  is_politically_exposed: boolean | null;
  submitted_at: Date | string;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  pan: string | null;
  aadhar: string | null;
  phone: string;
}

export interface PanVerificationModel {
  id: number;
  pan_id: number;
  pan: string;
  name_as_per_pan: string;
  verification_method: string;
  verification_status: VerificationStatus;
  verification_timestamp: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AadhaarVerificationModel {
  id: number;
  aadhar_id: number;
  aadhar: string;
  name_as_per_aadhaar: string;
  address: string | null;
  gender: string | null;
  verification_method: string;
  verification_status: VerificationStatus;
  verification_timestamp: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BankAccountModel {
  bank_id: number;
  account_no: string;
  micr_code: string | null;
  ifsc_code: string;
  account_holder_name: string;
  bank_name: string;
  verification_status: VerificationStatus;
  is_primary: boolean;
  validation?: BankValidationDetailsModel;
}

export interface BankValidationDetailsModel {
  id: number;
  bank_account_id: number;
  validation_method: string;
  validation_status: ValidationStatus;
  validation_timestamp: Date | string;
  remarks: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface NomineeModel {
  nominee_id: number;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  relationship: string;
  share: number;
}

export interface VerificationHistoryModel {
  id: number;
  checkpoint_id: number;
  action: ComplianceAction;
  status: ComplianceStatus;
  reason?: string;
  notes?: string;
  created_at: Date | string;
  officer_name: string | null;
}

export interface CheckpointBasicInfoModel {
  id: number;
  email: string | null;
  full_name: string | null;
}

export interface ComplianceOfficerModel {
  id: number;
  name: string;
}