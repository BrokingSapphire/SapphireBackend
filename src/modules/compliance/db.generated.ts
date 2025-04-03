// src/types/db.generated.ts
// This file should import all the types from your pasted code

import type { ColumnType } from 'kysely';

export type Generated<T> =
    T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;

export type Json = JsonValue;
export type JsonArray = JsonValue[];
export type JsonObject = { [x: string]: JsonValue | undefined };
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type UserAnnualIncome = '1_5_Lakh' | '10_25_Lakh' | '25_1_Cr' | '5_10_Lakh' | 'Ge_1_Cr' | 'le_1_Lakh';
export type UserInvestmentSegment = 'Cash' | 'Commodity' | 'Currency' | 'Debt' | 'F&O';
export type UserMaritalStatus = 'Divorced' | 'Married' | 'Single';
export type UserSettlement = 'Monthly' | 'Quarterly';
export type UserTradingExp = '1' | '1-5' | '10' | '5-10';

// Direct import of the DB interfaces from your provided code
export interface AadhaarDetail {
    address_id: number;
    co: number;
    created_at: Generated<Timestamp | null>;
    dob: Timestamp;
    gender: string;
    id: Generated<number>;
    masked_aadhaar_no: string;
    name: number;
    post_office: string;
}

export interface Address {
    address1: string;
    address2: string | null;
    city_id: number;
    country_id: string;
    id: Generated<number>;
    postal_id: number;
    state_id: number;
    street_name: string | null;
}

export interface BankAccount {
    account_no: string;
    id: Generated<number>;
    ifsc_code: string;
    micr_code: string;
}

export interface BankToCheckpoint {
    bank_account_id: number;
    checkpoint_id: number;
    is_primary: Generated<boolean>;
}

export interface BankToUser {
    bank_account_id: number;
    is_primary: Generated<boolean>;
    user_id: number;
}

export interface City {
    id: Generated<number>;
    name: string;
    state_id: number;
}

export interface Country {
    iso: string;
    name: string;
}

export interface HashingAlgorithm {
    id: Generated<number>;
    name: string;
}

export interface InvestmentSegmentsToCheckpoint {
    checkpoint_id: number;
    segment: UserInvestmentSegment;
}

export interface InvestmentSegmentsToUser {
    segment: UserInvestmentSegment;
    user_id: number;
}

export interface IpAddress {
    address: string;
    id: Generated<number>;
}

export interface Nominees {
    aadhaar_id: number;
    id: Generated<number>;
    name: number;
    pan_id: number;
    relationship: string;
    share: number;
}

export interface NomineesToCheckpoint {
    checkpoint_id: number;
    nominees_id: number;
}

export interface NomineesToUser {
    nominees_id: number;
    user_id: number;
}

export interface PanDetail {
    aadhaar_linked: boolean;
    address_id: number;
    category: string;
    created_at: Generated<Timestamp | null>;
    dob: Timestamp;
    dob_check: boolean;
    dob_verified: boolean;
    gender: string;
    id: Generated<number>;
    masked_aadhaar: string;
    name: number;
    pan_number: string;
    status: string;
}

export interface PhoneNumber {
    id: Generated<number>;
    phone: string;
}

export interface PostalCode {
    country_id: string;
    id: Generated<number>;
    postal_code: string;
}

export interface ProfilePictures {
    data: string;
    id: Generated<number>;
    user_id: number;
}

export interface SignupCheckpoints {
    aadhaar_id: number | null;
    account_settlement: UserSettlement | null;
    address_id: number | null;
    annual_income: UserAnnualIncome | null;
    created_at: Generated<Timestamp>;
    dob: Timestamp | null;
    email: string | null;
    father_name: number | null;
    id: Generated<number>;
    ipv: string | null;
    is_politically_exposed: boolean | null;
    marital_status: UserMaritalStatus | null;
    mother_name: number | null;
    name: number | null;
    occupation: string | null;
    pan_id: number | null;
    phone_id: number;
    signature: string | null;
    trading_exp: UserTradingExp | null;
    updated_at: Generated<Timestamp>;
}

export interface State {
    country_id: string;
    id: Generated<number>;
    name: string;
}

export interface User {
    aadhaar_id: number;
    account_settlement: UserSettlement;
    address_id: number;
    annual_income: UserAnnualIncome;
    created_at: Generated<Timestamp>;
    dob: Timestamp;
    email: string;
    father_name: number;
    id: number;
    ipv: string;
    is_password_changed: Generated<boolean>;
    is_politically_exposed: Generated<boolean>;
    marital_status: UserMaritalStatus;
    mother_name: number;
    name: number;
    occupation: string;
    pan_id: number;
    phone: number;
    signature: string;
    trading_exp: UserTradingExp;
    updated_at: Generated<Timestamp>;
}

export interface UserName {
    first_name: string;
    full_name: Generated<string | null>;
    id: Generated<number>;
    last_name: string | null;
    middle_name: string | null;
}

export interface UserPasswordDetails {
    hash_algo_id: number;
    password_hash: string;
    password_salt: string;
    user_id: number;
}

export interface UserSessions {
    device_info: Json | null;
    id: Generated<number>;
    ip_address: string;
    is_active: Generated<boolean | null>;
    last_activity: Generated<Timestamp>;
    location_data: Json | null;
    session_end: Timestamp | null;
    session_start: Generated<Timestamp>;
    user_agent: string | null;
    user_id: number;
}

export interface FundTransaction {
    id: number;
    user_id: number;
    transaction_type: 'deposit' | 'withdrawal';
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduled_processing_time: Date | null;
    remarks: string | null;
    created_at: Date;
    updated_at: Date | null;
}

export interface SettlementDetail {
    id: number;
    transaction_id: number;
    settlement_status: string;
    settlement_date: Date;
    settlement_reference: string | null;
    remarks: string | null;
    created_at: Date;
}

export interface TradeSettlement {
    id: number;
    order_id: number;
    user_id: number;
    trade_type: string;
    settlement_amount: number;
    status: 'scheduled' | 'processing' | 'completed' | 'failed';
    scheduled_settlement_time: Date;
    created_at: Date;
    updated_at: Date | null;
}

export interface TradingOrder {
    id: number;
    user_id: number;
    symbol: string;
    trade_type: string;
    order_type: string;
    price: number;
    quantity: number;
    status: string;
    total_value: number;
    settlement_id: number | null;
    created_at: Date;
    updated_at: Date | null;
}

export interface DB {
    aadhaar_detail: AadhaarDetail;
    address: Address;
    bank_account: BankAccount;
    bank_to_checkpoint: BankToCheckpoint;
    bank_to_user: BankToUser;
    city: City;
    country: Country;
    hashing_algorithm: HashingAlgorithm;
    investment_segments_to_checkpoint: InvestmentSegmentsToCheckpoint;
    investment_segments_to_user: InvestmentSegmentsToUser;
    ip_address: IpAddress;
    nominees: Nominees;
    nominees_to_checkpoint: NomineesToCheckpoint;
    nominees_to_user: NomineesToUser;
    pan_detail: PanDetail;
    phone_number: PhoneNumber;
    postal_code: PostalCode;
    profile_pictures: ProfilePictures;
    signup_checkpoints: SignupCheckpoints;
    state: State;
    user: User;
    user_name: UserName;
    user_password_details: UserPasswordDetails;
    user_sessions: UserSessions;
    fund_transactions: FundTransaction;
    settlement_details: SettlementDetail;
    trade_settlements: TradeSettlement;
    trading_orders: TradingOrder;
}