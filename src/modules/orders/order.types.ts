import { JwtPayloadWithoutWildcard } from '@app/types';

export type JwtType = JwtPayloadWithoutWildcard & {
    userId: number;
};

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell',
}

export enum ProductType {
    INTRADAY = 'intraday',
    DELIVERY = 'delivery',
    MTF = 'mtf',
    FUTURES = 'futures',
    OPTIONS = 'options',
    CURRENCY = 'currency',
}

export enum OrderType {
    MARKET_ORDER = 'market_order',
    LIMIT_ORDER = 'limit_order',
    SL = 'sl',
    SL_M = 'sl_m',
}

export enum OrderCategory {
    INSTANT = 'instant',
    NORMAL = 'normal',
    ICEBERG = 'iceberg',
    COVER_ORDER = 'cover_order',
}

export enum OrderStatus {
    QUEUED = 'queued',
    EXECUTED = 'executed',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    PENDING = 'pending',
}

export enum OrderValidity {
    DAY = 'day',
    IMMEDIATE = 'immediate',
    MINUTES = 'minutes',
}
