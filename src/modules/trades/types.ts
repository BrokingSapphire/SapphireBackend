/**
 * Trade section types for stock broking application
 * To be used with Kysely and PostgreSQL
 */

import type { ColumnType, Generated } from 'kysely';

// ---------------------------
// TRADE SECTION TYPES
// ---------------------------

// Enum types
export type TradeStatus = 'active' | 'target_hit' | 'stoploss_hit' | 'expired' | 'cancelled';
export type TradeType = 'buy' | 'sell';
export type InstrumentType = 'stock' | 'future' | 'option' | 'commodity';
export type OptionType = 'CALL' | 'PUT';

// Base Trade Advice Interface
export interface TradeAdvice {
    id: Generated<number>;
    instrument_type: InstrumentType;
    symbol: string;
    trade_type: TradeType;
    entry_price: number;
    entry_price_low: number | null;
    entry_price_high: number | null;
    stoploss: number;
    target: number;
    risk_reward_ratio: number;
    posted_by: number; // References user.id
    posted_at: Generated<Date>;
    closing_time: Date | null;
    exit_price: number | null;
    status: TradeStatus;
    notes: string | null;
}

// Stock-specific Trade Advice
export interface StockTradeAdvice {
    id: Generated<number>;
    trade_advice_id: number;
    quantity: number;
}

// Future-specific Trade Advice
export interface FutureTradeAdvice {
    id: Generated<number>;
    trade_advice_id: number;
    lot_size: number;
    expiry_date: Date;
}

// Commodity-specific Trade Advice
export interface CommodityTradeAdvice {
    id: Generated<number>;
    trade_advice_id: number;
    lot_size: number;
    expiry_date: Date;
}

// Option-specific Trade Advice
export interface OptionTradeAdvice {
    id: Generated<number>;
    trade_advice_id: number;
    lot_size: number;
    expiry_date: Date;
    strike_price: number;
    option_type: OptionType;
}

// Option Strategy
export interface OptionStrategy {
    id: Generated<number>;
    option_trade_advice_id: number;
    name: string;
    entry_price: number;
    exit_price: number | null;
    lot_size: number;
    leg_order: number;
}

// User Trade Subscription
export interface UserTradeSubscription {
    id: Generated<number>;
    user_id: number; // References user.id
    trade_advice_id: number;
    subscribed_at: Generated<Date>;
}

// Trade Advice Update
export interface TradeAdviceUpdate {
    id: Generated<number>;
    trade_advice_id: number;
    update_type: string;
    old_value: string | null;
    new_value: string | null;
    updated_at: Generated<Date>;
    updated_by: number; // References user.id
}

// Trade DB interface (to be used as extension to your main DB)
export interface TradeDB {
    trade_advice: TradeAdvice;
    stock_trade_advice: StockTradeAdvice;
    future_trade_advice: FutureTradeAdvice;
    commodity_trade_advice: CommodityTradeAdvice;
    option_trade_advice: OptionTradeAdvice;
    option_strategy: OptionStrategy;
    user_trade_subscription: UserTradeSubscription;
    trade_advice_update: TradeAdviceUpdate;
}