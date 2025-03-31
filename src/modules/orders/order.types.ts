// order.types.ts

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
  }
  
  export enum ProductType {
    INTRADAY = 'intraday',
    DELIVERY = 'delivery',
    MTF = 'mtf',
    FUTURES = 'futures',
    OPTIONS = 'options'
  }
  
  export enum OrderType {
    MARKET_ORDER = 'market_order',
    LIMIT_ORDER = 'limit_order',
    SL = 'sl',
    SL_M = 'sl_m'
  }
  
  export enum OrderCategory {
    INSTANT = 'instant',
    NORMAL = 'normal',
    ICEBERG = 'iceberg',
    COVER_ORDER = 'cover_order'
  }
  
  export enum OrderStatus {
    QUEUED = 'queued',
    EXECUTED = 'executed',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    PENDING = 'pending'
  }
  
  export enum OrderValidity {
    DAY = 'day',
    IMMEDIATE = 'immediate',
    MINUTES = 'minutes'
  }
  
  export interface OrderBase {
    symbol: string;
    orderSide: OrderSide;
    quantity: number;
    price?: number;
  }
  
  export interface InstantOrderRequest extends OrderBase {
    productType: ProductType;
    orderType: OrderType.MARKET_ORDER | OrderType.LIMIT_ORDER;
  }
  
  export interface NormalOrderRequest extends OrderBase {
    orderType: OrderType;
    triggerPrice?: number;
    validity: OrderValidity;
    validityMinutes?: number;
    disclosedQuantity?: number;
  }
  
  export interface IcebergOrderRequest extends OrderBase {
    orderType: OrderType;
    triggerPrice?: number;
    validity: OrderValidity;
    validityMinutes?: number;
    disclosedQuantity: number;
    numOfLegs: number;
    productType: ProductType.INTRADAY | ProductType.DELIVERY;
  }
  
  export interface CoverOrderRequest extends OrderBase {
    orderType: OrderType.MARKET_ORDER | OrderType.LIMIT_ORDER;
    stopLossPrice: number;
  }
  
  export interface OrderHistoryRequest {
    orderId: number;
  }
  
  export interface OrderCancelRequest {
    orderId: number;
  }
  
  export interface UserOrdersRequest {
    userId: number;
    status?: OrderStatus;
    category?: OrderCategory;
    page?: number;
    limit?: number;
  }
  
  export interface RecentOrdersRequest {
    userId: number;
    limit?: number;
  }
  
  export interface OrderFailedAttemptsRequest {
    userId: number;
    page?: number;
    limit?: number;
  }
  
  export interface OrderSummaryRequest {
    userId: number;
  }
  
  export interface OrderDetailsRequest {
    orderId: number;
  }
  
  export interface UserFunds {
    id: number;
    user_id: number;
    total_funds: number;
    available_funds: number;
    blocked_funds: number;
    used_funds: number;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface OrderAttemptFailure {
    user_id: number;
    order_category: OrderCategory;
    symbol: string;
    order_side: OrderSide;
    quantity: number;
    price: number;
    product_type: string;
    order_type: string;
    failure_reason: string;
    required_funds: number;
    available_funds: number;
    attempted_at: Date;
  }
  
  export interface CategorySummary {
    total: number;
    queued: number;
    executed: number;
    rejected: number;
    cancelled: number;
  }
  
  export interface OrderSummaryResponse {
    total: number;
    byCategory: {
      instant: CategorySummary;
      normal: CategorySummary;
      iceberg: CategorySummary;
      cover_order: CategorySummary;
    };
    byStatus: {
      queued: number;
      executed: number;
      rejected: number;
      cancelled: number;
    };
}