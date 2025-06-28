import logger from '@app/logger';

interface OrderNotificationData {
    orderStatus: string;
    scripName: string;
    message: string;
    orderNumber: string;
}

export enum OrderNotificationType {
    ORDER_PLACED = 'ORDER_PLACED',
    ORDER_MODIFIED = 'ORDER_MODIFIED',
    ORDER_CANCELLED = 'ORDER_CANCELLED',
    ORDER_EXECUTED = 'ORDER_EXECUTED',
    ORDER_REJECTED = 'ORDER_REJECTED',
}

export enum NotificationSeverity {
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

interface OrderNotificationPayload {
    id: string;
    type: OrderNotificationType;
    title: string;
    message: string;
    severity: NotificationSeverity;
    timestamp: Date;
    orderData: OrderNotificationData;
}

class OrderNotificationService {
    /**
     * Create notification payload for order events
     */
    public createOrderNotification(
        type: OrderNotificationType,
        orderData: OrderNotificationData,
    ): OrderNotificationPayload {
        const notification: OrderNotificationPayload = {
            id: this.generateNotificationId(),
            type,
            title: this.getNotificationTitle(type),
            message: this.getNotificationMessage(type, orderData),
            severity: this.getNotificationSeverity(type),
            timestamp: new Date(),
            orderData,
        };
        logger.debug(`Created ${type} notification for order ${orderData.orderNumber}`);
        return notification;
    }

    /**
     * Get notification title based on type
     */
    private getNotificationTitle(type: OrderNotificationType): string {
        switch (type) {
            case OrderNotificationType.ORDER_PLACED:
                return 'Order Placed';
            case OrderNotificationType.ORDER_MODIFIED:
                return 'Order Modified';
            case OrderNotificationType.ORDER_CANCELLED:
                return 'Order Cancelled';
            case OrderNotificationType.ORDER_EXECUTED:
                return 'Order Executed';
            case OrderNotificationType.ORDER_REJECTED:
                return 'Order Rejected';
            default:
                return 'Order Update';
        }
    }

    /**
     * Get notification message based on type and order data
     */
    private getNotificationMessage(type: OrderNotificationType, orderData: OrderNotificationData): string {
        switch (type) {
            case OrderNotificationType.ORDER_PLACED:
                return `${orderData.scripName} order #${orderData.orderNumber} placed successfully`;
            case OrderNotificationType.ORDER_MODIFIED:
                return `${orderData.scripName} order #${orderData.orderNumber} modified successfully`;
            case OrderNotificationType.ORDER_CANCELLED:
                return `${orderData.scripName} order #${orderData.orderNumber} cancelled`;
            case OrderNotificationType.ORDER_EXECUTED:
                return `${orderData.scripName} order #${orderData.orderNumber} executed successfully`;
            case OrderNotificationType.ORDER_REJECTED:
                return `${orderData.scripName} order #${orderData.orderNumber} rejected: ${orderData.message}`;
            default:
                return `${orderData.scripName} order #${orderData.orderNumber}: ${orderData.message}`;
        }
    }

    /**
     * Get notification severity based on type
     */
    private getNotificationSeverity(type: OrderNotificationType): NotificationSeverity {
        switch (type) {
            case OrderNotificationType.ORDER_PLACED:
            case OrderNotificationType.ORDER_EXECUTED:
                return NotificationSeverity.SUCCESS;
            case OrderNotificationType.ORDER_MODIFIED:
            case OrderNotificationType.ORDER_CANCELLED:
                return NotificationSeverity.WARNING;
            case OrderNotificationType.ORDER_REJECTED:
                return NotificationSeverity.ERROR;
            default:
                return NotificationSeverity.INFO;
        }
    }

    /**
     * Generate unique notification ID
     */
    private generateNotificationId(): string {
        return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

const orderNotificationService = new OrderNotificationService();

/**
 * Helper function to create order placed notification
 */
export function createOrderPlacedNotification(orderData: OrderNotificationData): OrderNotificationPayload {
    return orderNotificationService.createOrderNotification(OrderNotificationType.ORDER_PLACED, orderData);
}

/**
 * Helper function to create order modified notification
 */
export function createOrderModifiedNotification(orderData: OrderNotificationData): OrderNotificationPayload {
    return orderNotificationService.createOrderNotification(OrderNotificationType.ORDER_MODIFIED, orderData);
}

/**
 * Helper function to create order cancelled notification
 */
export function createOrderCancelledNotification(orderData: OrderNotificationData): OrderNotificationPayload {
    return orderNotificationService.createOrderNotification(OrderNotificationType.ORDER_CANCELLED, orderData);
}

/**
 * Helper function to create order executed notification
 */
export function createOrderExecutedNotification(orderData: OrderNotificationData): OrderNotificationPayload {
    return orderNotificationService.createOrderNotification(OrderNotificationType.ORDER_EXECUTED, orderData);
}

/**
 * Helper function to create order rejected notification
 */
export function createOrderRejectedNotification(orderData: OrderNotificationData): OrderNotificationPayload {
    return orderNotificationService.createOrderNotification(OrderNotificationType.ORDER_REJECTED, orderData);
}

export { OrderNotificationService, OrderNotificationData, OrderNotificationPayload };
export default orderNotificationService;
