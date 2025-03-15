// order.ws.ts
import { WebSocketClient, WebSocketManager } from './order.types';
import { Order, IcebergLeg, CoverOrderDetails } from './order.types';

/**
 * Enum defining WebSocket event types related to orders
 */
export enum OrderWebSocketEventType {
  INSTANT_ORDER_CREATED = 'INSTANT_ORDER_CREATED',
  NORMAL_ORDER_CREATED = 'NORMAL_ORDER_CREATED',
  ICEBERG_ORDER_CREATED = 'ICEBERG_ORDER_CREATED',
  COVER_ORDER_CREATED = 'COVER_ORDER_CREATED',
  ORDER_EXECUTED = 'ORDER_EXECUTED',
  ICEBERG_LEG_EXECUTED = 'ICEBERG_LEG_EXECUTED',
  STOP_LOSS_EXECUTED = 'STOP_LOSS_EXECUTED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_UPDATED = 'ORDER_UPDATED'
}

/**
 * Interfaces for WebSocket event payloads
 */
export interface OrderCreatedEvent {
  order: Order;
  [key: string]: any; // Additional properties depend on order type
}

export interface OrderExecutedEvent {
  order: Order;
  charges?: {
    total_charges: number;
    applied_charges: any[];
  };
  [key: string]: any; // Additional properties for specific order types
}

export interface IcebergLegExecutedEvent {
  executedLeg: IcebergLeg;
  nextLeg: IcebergLeg | null;
  hasMoreLegs: boolean;
  executionPrice: number;
  exchangeOrderId?: string;
  productType: string;
  charges: any;
}

export interface StopLossExecutedEvent {
  coverOrderDetails: CoverOrderDetails;
  executionPrice: number;
  exchangeOrderId?: string;
  charges: any;
}

export interface OrderRejectedEvent {
  order: Order;
}

export interface OrderCancelledEvent {
  order: Order;
}

// Union type for all WebSocket event payloads
export type OrderWebSocketEventPayload = 
  | OrderCreatedEvent
  | OrderExecutedEvent
  | IcebergLegExecutedEvent
  | StopLossExecutedEvent
  | OrderRejectedEvent
  | OrderCancelledEvent;

/**
 * WebSocket event interface
 */
export interface OrderWebSocketEvent {
  type: OrderWebSocketEventType;
  data: OrderWebSocketEventPayload;
}

/**
 * Class for handling order-related WebSocket notifications
 */
export class OrderWebSocketHandler {
  constructor(private readonly wsManager: WebSocketManager) {}

  /**
   * Send WebSocket notification
   */
  public sendNotification(userId: number, event: OrderWebSocketEvent): void {
    const wsClient = this.wsManager.getClient ? this.wsManager.getClient(userId.toString()) : null;
    
    if (wsClient) {
      wsClient.send(JSON.stringify(event));
    }
  }

  /**
   * Send notification for order creation
   */
  public notifyOrderCreated(userId: number, type: OrderWebSocketEventType, data: OrderCreatedEvent): void {
    this.sendNotification(userId, {
      type,
      data
    });
  }

  /**
   * Send notification for order execution
   */
  public notifyOrderExecuted(userId: number, data: OrderExecutedEvent): void {
    this.sendNotification(userId, {
      type: OrderWebSocketEventType.ORDER_EXECUTED,
      data
    });
  }

  /**
   * Send notification for iceberg leg execution
   */
  public notifyIcebergLegExecuted(userId: number, data: IcebergLegExecutedEvent): void {
    this.sendNotification(userId, {
      type: OrderWebSocketEventType.ICEBERG_LEG_EXECUTED,
      data
    });
  }

  /**
   * Send notification for stop loss execution
   */
  public notifyStopLossExecuted(userId: number, data: StopLossExecutedEvent): void {
    this.sendNotification(userId, {
      type: OrderWebSocketEventType.STOP_LOSS_EXECUTED,
      data
    });
  }

  /**
   * Send notification for order rejection
   */
  public notifyOrderRejected(userId: number, data: OrderRejectedEvent): void {
    this.sendNotification(userId, {
      type: OrderWebSocketEventType.ORDER_REJECTED,
      data
    });
  }

  /**
   * Send notification for order cancellation
   */
  public notifyOrderCancelled(userId: number, data: OrderCancelledEvent): void {
    this.sendNotification(userId, {
      type: OrderWebSocketEventType.ORDER_CANCELLED,
      data
    });
  }
}

/**
 * Factory function to create OrderWebSocketHandler instance
 */
export const createOrderWebSocketHandler = (wsManager: WebSocketManager): OrderWebSocketHandler => {
  return new OrderWebSocketHandler(wsManager);
};

export default createOrderWebSocketHandler;