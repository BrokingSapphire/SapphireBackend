// validator.ts
import { Request, Response, NextFunction } from 'express';
import { CreateOrderRequest, TradeType, OrderSide, OrderType, MarginSource } from './rms.types';

export class TradingValidator {
    /**
     * Validate create order request
     */
    static validateCreateOrder(req: Request, res: Response, next: NextFunction): void | Response {
        const { tradeType, orderSide, orderType, symbol, quantity, price, triggerPrice, marginSource } =
            req.body as CreateOrderRequest;

        // Validate required fields
        if (!tradeType || !orderSide || !orderType || !symbol || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields for order creation',
            });
        }

        // Validate trade type
        const validTradeTypes = Object.values(TradeType);
        if (!validTradeTypes.includes(tradeType as TradeType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid trade type',
            });
        }

        // Validate order side
        const validOrderSides = Object.values(OrderSide);
        if (!validOrderSides.includes(orderSide as OrderSide)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order side',
            });
        }

        // Validate order type
        const validOrderTypes = Object.values(OrderType);
        if (!validOrderTypes.includes(orderType as OrderType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order type',
            });
        }

        // Validate quantity
        if (quantity <= 0 || !Number.isInteger(quantity)) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer',
            });
        }

        // Validate price for limit orders
        if (
            (orderType === OrderType.LIMIT || orderType === OrderType.STOP_LOSS_LIMIT) &&
            (price === undefined || price <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Price is required for limit orders and must be positive',
            });
        }

        // Validate trigger price for stop loss orders
        if (
            (orderType === OrderType.STOP_LOSS || orderType === OrderType.STOP_LOSS_LIMIT) &&
            (triggerPrice === undefined || triggerPrice <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Trigger price is required for stop loss orders and must be positive',
            });
        }

        // Validate margin source if provided
        if (marginSource) {
            const validMarginSources = Object.values(MarginSource);
            if (!validMarginSources.includes(marginSource as MarginSource)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid margin source',
                });
            }
        }

        next();
    }

    /**
     * Validate user ID parameter
     */
    static validateUserId(req: Request, res: Response, next: NextFunction): void | Response {
        const userId = parseInt(req.params.userId, 10);

        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
            });
        }

        next();
    }

    /**
     * Validate order ID parameter
     */
    static validateOrderId(req: Request, res: Response, next: NextFunction): void | Response {
        const orderId = parseInt(req.params.orderId, 10);

        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID',
            });
        }

        next();
    }

    /**
     * Validate position ID parameter
     */
    static validatePositionId(req: Request, res: Response, next: NextFunction): void | Response {
        const positionId = parseInt(req.params.positionId, 10);

        if (isNaN(positionId) || positionId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid position ID',
            });
        }

        next();
    }

    /**
     * Validate trade segment parameter
     */
    static validateTradeSegment(req: Request, res: Response, next: NextFunction): void | Response {
        const segment = req.params.segment;
        const validTradeTypes = Object.values(TradeType);

        if (!validTradeTypes.includes(segment as TradeType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid trade segment',
            });
        }

        next();
    }

    /**
     * Validate pagination parameters
     */
    static validatePagination(req: Request, res: Response, next: NextFunction): void {
        if (req.query.limit) {
            const limit = parseInt(req.query.limit as string, 10);
            if (isNaN(limit) || limit <= 0) {
                req.query.limit = '20'; // Default value
            }
        }

        if (req.query.offset) {
            const offset = parseInt(req.query.offset as string, 10);
            if (isNaN(offset) || offset < 0) {
                req.query.offset = '0'; // Default value
            }
        }

        next();
    }
}
