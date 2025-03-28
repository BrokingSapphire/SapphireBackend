// funds.types.ts

// import { Numeric, Timestamp } from "../../database/db";

export interface FundTransaction {
    id?: number;
    user_id: number;
    transaction_type: string; // Changed from enum to string to match database
    amount: number | string;
    original_amount?: number | string | null;
    status: string; // Changed from enum to string to match database
    bank_account_id: number;
    remarks?: string | null;
    transaction_date: Date;
    created_at?: Date;
    updated_at?: Date;
    processed_at?: Date | null;
    transaction_id?: string | null;
    safety_cut_amount?: number | string | null;
    safety_cut_percentage?: number | string | null;
    processing_window?: string | null;
    scheduled_processing_time?: Date | null;
}

export interface UserFunds {
    id?: number;
    user_id: number;
    total_funds: number | string;
    available_funds: number | string;
    blocked_funds: number | string;
    used_funds: number | string;
    created_at?: Date;
    updated_at?: Date;
}

export interface MarginTransaction {
    id?: number;
    user_id: number;
    transaction_type: string;
    amount: number | string;
    reason?: string | null;
    created_at: Date;
    updated_at?: Date | null;
}

export interface UserMargin {
    id?: number;
    user_id: number;
    cash_margin: number | string;
    pledge_margin: number | string;
    total_margin: number | string;
    available_margin: number | string;
    used_margin: number | string;
    is_negative_cash_allowed?: boolean | null;
    negative_cash_limit?: number | null;
    created_at?: Date;
    updated_at?: Date;
}

export interface BankToUser {
    bank_account_id: number;
    user_id: number;
    is_primary?: boolean;
}

export interface TradingPosition {
    id?: number;
    user_id: number;
    symbol: string;
    order_side: 'buy' | 'sell';
    quantity: number;
    entry_price: number | string;
    current_price: number | string;
    trade_type: 'equity_futures' | 'equity_options' | 'equity_delivery' | 'equity_intraday' | string;
    margin_source: 'cash' | 'pledge' | 'both';
    margin_used: number | string;
    pnl?: number | string;
    mtm_pnl?: number | string;
    open_date?: Date;
    last_updated?: Date;
    created_at?: Date | null;
}

export interface WithdrawalRequest extends FundTransaction {
    processingTime?: Date | null;
    window?: string | null;
    safetyCut?: {
        percentage: number;
        amount: number | string;
        reason: string | null;
        originalAmount?: number | string;
        finalAmount?: number | string;
    };
}

export interface DepositRequest {
    amount: number;
    bankAccountId: number;
    remarks?: string;
}

export interface WithdrawalProcessRequest {
    amount: number;
    bankAccountId: number;
    remarks?: string;
}

export interface FundsResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
