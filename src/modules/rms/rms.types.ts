// types.ts

import { Generated } from 'kysely';

// Enums
export enum TradeType {
    EQUITY_DELIVERY = 'equity_delivery',
    EQUITY_INTRADAY = 'equity_intraday',
    EQUITY_FUTURES = 'equity_futures',
    EQUITY_OPTIONS = 'equity_options',
    COMMODITY_FUTURES = 'commodity_futures',
    COMMODITY_OPTIONS = 'commodity_options',
    CURRENCY_FUTURES = 'currency_futures',
    CURRENCY_OPTIONS = 'currency_options',
}

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell',
}

export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit',
    STOP_LOSS = 'stop_loss',
    STOP_LOSS_LIMIT = 'stop_loss_limit',
}

export enum OrderStatus {
    PENDING = 'pending',
    EXECUTED = 'executed',
    CANCELLED = 'cancelled',
    REJECTED = 'rejected',
}

export enum MarginSource {
    CASH = 'cash',
    PLEDGE = 'pledge',
    BOTH = 'both',
}

export enum TransactionType {
    MARGIN_CUT = 'margin_cut',
    MARGIN_ADDITION = 'margin_addition',
    MARGIN_RELEASE = 'margin_release',
}

export enum CollateralStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

// Interfaces for database tables with Generated ID fields
export interface TradingRule {
    id: Generated<number>;
    trade_segment: TradeType;
    margin_percentage: number;
    max_leverage: number;
    is_active: boolean;
    created_at: Date;
    updated_at?: Date;
}

// Interface for inserting records (without ID field which is auto-generated)
export interface InsertableTradingRule {
    trade_segment: TradeType;
    margin_percentage: number;
    max_leverage: number;
    is_active: boolean;
    created_at: Date;
    updated_at?: Date;
}

export interface UserMargin {
    id: number;
    user_id: number;
    cash_margin: number;
    pledge_margin: number;
    total_margin: number;
    available_margin: number;
    used_margin: number;
    blocked_margin?: number;
    negative_cash_limit?: number;
    is_negative_cash_allowed?: boolean;
    created_at: Date;
    updated_at?: Date;
}

export interface InsertableUserMargin {
    user_id: number;
    cash_margin: number;
    pledge_margin: number;
    total_margin: number;
    available_margin: number;
    used_margin: number;
    blocked_margin?: number;
    negative_cash_limit?: number;
    is_negative_cash_allowed?: boolean;
    created_at: Date;
    updated_at?: Date;
}

export interface UserFunds {
    id: Generated<number>;
    user_id: number;
    total_funds: number;
    available_funds: number;
    used_funds: number;
    created_at: Date;
    updated_at?: Date;
}

export interface InsertableUserFunds {
    user_id: number;
    total_funds: number;
    available_funds: number;
    used_funds: number;
    created_at: Date;
    updated_at?: Date;
}

export interface TradingOrder {
    id: Generated<number>;
    user_id: number;
    trade_type: TradeType;
    order_side: OrderSide;
    order_type: OrderType;
    symbol: string;
    quantity: number;
    price: number | null;
    trigger_price: number | null;
    status: OrderStatus;
    margin_used: number;
    margin_source: MarginSource;
    order_date: Date;
    execution_date?: Date;
    remarks?: string;
    created_at: Date;
    updated_at?: Date;
}

export interface InsertableTradingOrder {
    user_id: number;
    trade_type: TradeType;
    order_side: OrderSide;
    order_type: OrderType;
    symbol: string;
    quantity: number;
    price: number | null;
    trigger_price: number | null;
    status: OrderStatus;
    margin_used: number;
    margin_source: MarginSource;
    order_date: Date;
    execution_date?: Date;
    remarks?: string;
    created_at: Date;
    updated_at?: Date;
}

export interface TradingPosition {
    id: Generated<number>;
    user_id: number;
    trade_type: TradeType;
    order_side: OrderSide;
    symbol: string;
    quantity: number;
    entry_price: number;
    current_price: number;
    margin_used: number;
    margin_source: MarginSource;
    mtm_profit: number;
    mtm_loss: number;
    created_at: Date;
    updated_at?: Date;
}

export interface InsertableTradingPosition {
    user_id: number;
    trade_type: TradeType;
    order_side: OrderSide;
    symbol: string;
    quantity: number;
    entry_price: number;
    current_price: number;
    margin_used: number;
    margin_source: MarginSource;
    mtm_profit: number;
    mtm_loss: number;
    created_at: Date;
    updated_at?: Date;
}

export interface UserCollateral {
    id: Generated<number>;
    user_id: number;
    security_id: string;
    security_name: string;
    quantity: number;
    value: number;
    haircut_percentage: number;
    margin_value: number;
    status: CollateralStatus;
    created_at: Date;
    updated_at?: Date;
}

export interface InsertableUserCollateral {
    user_id: number;
    security_id: string;
    security_name: string;
    quantity: number;
    value: number;
    haircut_percentage: number;
    margin_value: number;
    status: CollateralStatus;
    created_at: Date;
    updated_at?: Date;
}

export interface MarginTransaction {
    id: Generated<number>;
    user_id: number;
    transaction_type: TransactionType;
    amount: number;
    reason: string;
    created_at: Date;
}

export interface InsertableMarginTransaction {
    user_id: number;
    transaction_type: TransactionType;
    amount: number;
    reason: string;
    created_at: Date;
}

export interface MarginAllocation {
    totalMarginAvailable: number;
    cashMarginUsed: number;
    pledgeMarginUsed: number;
    marginSource: MarginSource;
}

// Request and Response Types
export interface CreateOrderRequest {
    tradeType: TradeType;
    orderSide: OrderSide;
    orderType: OrderType;
    symbol: string;
    quantity: number;
    price?: number;
    triggerPrice?: number;
    marginSource?: MarginSource;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

// WebSocket Types
export interface WebSocketMessage {
    type: string;
    data: any;
}

export interface OrderCreatedMessage extends WebSocketMessage {
    type: 'ORDER_CREATED';
    data: {
        order: TradingOrder;
        marginDetails: MarginAllocation;
    };
}

export interface OrderCancelledMessage extends WebSocketMessage {
    type: 'ORDER_CANCELLED';
    data: TradingOrder;
}

export interface PositionSquaredOffMessage extends WebSocketMessage {
    type: 'POSITION_SQUARED_OFF';
    data: {
        order: TradingOrder;
        position: TradingPosition;
    };
}

export interface MarginCutAppliedMessage extends WebSocketMessage {
    type: 'MARGIN_CUT_APPLIED';
    data: {
        marginCut: number;
        totalM2MLoss: number;
        marginCutRecord: MarginTransaction;
    };
}
