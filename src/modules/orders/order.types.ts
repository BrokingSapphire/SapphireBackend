// order.types.ts
import { Request, Response } from 'express';

// Order category types
export type OrderCategory = 'instant' | 'normal' | 'iceberg' | 'cover_order';

// Order side types
export type OrderSide = 'buy' | 'sell';

// Order status types
export type OrderStatus = 'queued' | 'executed' | 'rejected' | 'cancelled' | 'pending';

// Order type types
export type OrderType = 'market_order' | 'limit_order' | 'sl' | 'sl_m';

// Product type types
export type ProductType = 'intraday' | 'delivery' | 'mtf' | 'futures' | 'options';

// Order validity types
export type OrderValidity = 'day' | 'immediate' | 'minutes';

// Request interfaces
export interface CreateInstantOrderRequest {
  symbol: string;
  orderSide: OrderSide;
  quantity: number;
  price?: number;
  productType: ProductType;
  orderType: OrderType;
}

export interface CreateNormalOrderRequest {
  symbol: string;
  orderSide: OrderSide;
  quantity: number;
  price?: number;
  orderType: OrderType;
  triggerPrice?: number;
  validity: OrderValidity;
  validityMinutes?: number;
  disclosedQuantity?: number;
}

export interface CreateIcebergOrderRequest {
  symbol: string;
  orderSide: OrderSide;
  quantity: number;
  price?: number;
  orderType: OrderType;
  triggerPrice?: number;
  validity: OrderValidity;
  validityMinutes?: number;
  disclosedQuantity: number;
  numOfLegs: number;
  productType: 'intraday' | 'delivery';
}

export interface CreateCoverOrderRequest {
  symbol: string;
  orderSide: OrderSide;
  quantity: number;
  price?: number;
  orderType: OrderType;
  stopLossPrice: number;
}

export interface GetOrdersQueryParams {
  status?: OrderStatus;
  category?: OrderCategory;
  page?: string;
  limit?: string;
}

export interface GetFailedAttemptsQueryParams {
  page?: string;
  limit?: string;
}

// Database entity interfaces
export interface Order {
  id: number;
  user_id: number;
  order_category: OrderCategory;
  symbol: string;
  order_side: OrderSide;
  quantity: number;
  price: number | null;
  status: OrderStatus;
  placed_at: Date;
  executed_at?: Date | null;
  cancelled_at?: Date | null;
  rejected_reason?: string | null;
  total_charges?: number | null;
  order_id?: string | null;
  updated_at?: Date | null;
}

export interface InstantOrder {
  order_id: number;
  product_type: ProductType;
  order_type: OrderType;
}

export interface NormalOrder {
  order_id: number;
  order_type: OrderType;
  trigger_price: number | null;
  validity: OrderValidity;
  validity_minutes: number | null;
  disclosed_quantity: number | null;
}

export interface IcebergOrder {
  order_id: number;
  num_of_legs: number;
  order_type: OrderType;
  product_type: ProductType;
  trigger_price?: number | null;
  validity: OrderValidity;
  validity_minutes?: number | null;
  disclosed_quantity: number;
}

export interface IcebergLeg {
  id: number;
  iceberg_order_id: number;
  leg_number: number;
  quantity: number;
  status: OrderStatus;
  executed_at?: Date | null;
  cancelled_at?: Date | null;
  rejected_reason?: string | null;
}

export interface CoverOrder {
  order_id: number;
  stop_loss_price: number;
  order_type: OrderType;
}

export interface CoverOrderDetails {
  id: number;
  cover_order_id: number;
  main_order_status: OrderStatus;
  main_order_executed_at?: Date | null;
  main_order_id?: string | null;
  stop_loss_order_status: OrderStatus;
  stop_loss_executed_at?: Date | null;
  stop_loss_order_id?: string | null;
}

export interface UserFunds {
  id: number;
  user_id: number;
  available_funds: number;
  used_funds: number;
  total_funds: number;
  blocked_funds: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderAttemptFailure {
  id: number;
  user_id: number;
  order_category: OrderCategory;
  symbol: string;
  order_side: OrderSide;
  quantity: number;
  price: number | null;
  product_type: ProductType | null;
  order_type: OrderType | null;
  failure_reason: string;
  required_funds: number | null;
  available_funds: number | null;
  attempted_at: Date;
}

export interface OrderHistory {
  id: number;
  order_id: number;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_at: Date;
  remarks: string | null;
  changed_by: string | null;
}

// Response interfaces
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface OrderSummaryData {
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

export interface CategorySummary {
  total: number;
  queued: number;
  executed: number;
  rejected: number;
  cancelled: number;
}

// Utility interfaces
export interface WebSocketManager {
  getClient?: (userId: string) => WebSocketClient | null;
}

export interface WebSocketClient {
  send: (data: string) => void;
}

export interface TransactionContext {
  selectFrom: any;
  insertInto: any;
  updateTable: any;
  deleteFrom: any;
}

// Controller interface
export interface OrderManagementController {
  createInstantOrder: (req: Request, res: Response) => Promise<void>;
  createNormalOrder: (req: Request, res: Response) => Promise<void>;
  createIcebergOrder: (req: Request, res: Response) => Promise<void>;
  createCoverOrder: (req: Request, res: Response) => Promise<void>;
  getUserOrders: (req: Request, res: Response) => Promise<void>;
  getOrderById: (req: Request, res: Response) => Promise<void>;
  cancelOrder: (req: Request, res: Response) => Promise<void>;
  getOrderHistory: (req: Request, res: Response) => Promise<void>;
  getOrderSummary: (req: Request, res: Response) => Promise<void>;
  getRecentOrders: (req: Request, res: Response) => Promise<void>;
  getFailedOrderAttempts: (req: Request, res: Response) => Promise<void>;
}