// controller.ts
import { Request, Response } from 'express';
import db from './db.config';
import { wsManager } from './rms.ws';
import { calculateMarginAllocation, getCurrentMarketPrice, assertNonNull } from './rms.utils';
import {
    TradingRule,
    UserMargin,
    CreateOrderRequest,
    TradeType,
    OrderSide,
    OrderType,
    OrderStatus,
    MarginSource,
    TradingOrder,
    TradingPosition,
    UserCollateral,
    MarginTransaction,
    ApiResponse,
    TransactionType,
    CollateralStatus,
    InsertableUserMargin,
    InsertableTradingOrder,
    InsertableMarginTransaction,
} from './rms.types';
import logger from '@app/logger';

export class TradingController {
    /**
     * Get all trading rules
     */
    async getTradingRules(req: Request, res: Response): Promise<Response> {
        try {
            const rules = await db
                .selectFrom('trading_rules')
                .where('is_active', '=', true)
                .orderBy('id')
                .selectAll()
                .execute();

            return res.status(200).json({
                success: true,
                data: rules,
            });
        } catch (error) {
            logger.error('Error fetching trading rules:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch trading rules',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get trading rule by segment
     */
    async getTradingRuleBySegment(req: Request, res: Response): Promise<Response> {
        try {
            const tradeSegment = req.params.segment as TradeType;

            const rule = await db
                .selectFrom('trading_rules')
                .where('trade_segment', '=', tradeSegment)
                .where('is_active', '=', true)
                .selectAll()
                .executeTakeFirst();

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    message: `Trading rule for ${tradeSegment} not found`,
                });
            }

            return res.status(200).json({
                success: true,
                data: rule,
            });
        } catch (error) {
            logger.error('Error fetching trading rule:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch trading rule',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Create order with enhanced margin allocation
     */
    async createOrder(req: Request, res: Response): Promise<Response> {
        try {
            const userId = parseInt(req.params.userId, 10);
            const {
                tradeType,
                orderSide,
                orderType,
                symbol,
                quantity,
                price,
                triggerPrice,
                marginSource = MarginSource.BOTH,
            } = req.body as CreateOrderRequest;

            const result = await db.transaction().execute(async (trx) => {
                // Get trading rule and user margin details
                const rule = await trx
                    .selectFrom('trading_rules')
                    .where('trade_segment', '=', tradeType)
                    .where('is_active', '=', true)
                    .selectAll()
                    .executeTakeFirst();

                const userMargin = await trx
                    .selectFrom('user_margin')
                    .where('user_id', '=', userId)
                    .selectAll()
                    .executeTakeFirst();

                if (!rule) {
                    throw new Error(`No active trading rule found for ${tradeType}`);
                }

                if (!userMargin) {
                    throw new Error(`User margin not found for user ID ${userId}`);
                }

                // Validate price for specific order types
                const orderPrice = price || (await getCurrentMarketPrice(symbol, tradeType));
                const totalOrderValue = orderPrice * quantity;

                // Calculate required margin
                const requiredMargin = (totalOrderValue * rule.margin_percentage) / 100;

                const marginAllocation = calculateMarginAllocation(
                    userMargin as UserMargin,
                    requiredMargin,
                    rule.max_leverage,
                    marginSource as MarginSource,
                );

                // Validate margin availability
                if (marginAllocation.totalMarginAvailable < requiredMargin) {
                    throw new Error('Insufficient margin for placing this order');
                }

                // Create order with detailed margin breakdown
                const orderData = {
                    user_id: userId,
                    trade_type: tradeType,
                    order_side: orderSide,
                    order_type: orderType,
                    symbol,
                    quantity,
                    price: orderPrice,
                    trigger_price: triggerPrice || null,
                    status: OrderStatus.PENDING,
                    margin_used: requiredMargin,
                    margin_source: marginAllocation.marginSource,
                    order_date: new Date(),
                    created_at: new Date(),
                };

                const createdOrder = await trx
                    .insertInto('trading_orders')
                    .values(orderData)
                    .returningAll()
                    .executeTakeFirst();

                if (!createdOrder) {
                    throw new Error('Failed to create order');
                }

                // Update user margin with intelligent allocation
                await trx
                    .updateTable('user_margin')
                    .set({
                        cash_margin: (eb: any) => eb.ref('cash_margin').subtract(marginAllocation.cashMarginUsed),
                        pledge_margin: (eb: any) => eb.ref('pledge_margin').subtract(marginAllocation.pledgeMarginUsed),
                        used_margin: (eb: any) => eb.ref('used_margin').add(requiredMargin),
                        available_margin: (eb: any) => eb.ref('available_margin').subtract(requiredMargin),
                        updated_at: new Date(),
                    })
                    .where('user_id', '=', userId)
                    .execute();

                return {
                    order: createdOrder,
                    marginAllocation,
                    orderPrice,
                };
            });

            // WebSocket notification
            wsManager.sendMessage(userId.toString(), {
                type: 'ORDER_CREATED',
                data: {
                    order: result.order,
                    marginDetails: result.marginAllocation,
                },
            });

            return res.status(201).json({
                success: true,
                data: result.order,
                marginDetails: result.marginAllocation,
                message: 'Order created successfully',
            });
        } catch (error) {
            logger.error('Error creating order:', error);

            // Specific error handling
            if (error instanceof Error) {
                if (error.message.includes('Insufficient margin') || error.message.includes('Negative cash limit')) {
                    return res.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to create order',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user margin
     */
    async getUserMargin(req: Request, res: Response): Promise<Response> {
        try {
            logger.info('getUserMargin called with userId:', req.params.userId);

            const userId = parseInt(req.params.userId, 10);
            logger.info('Parsed userId:', userId);

            // Get or initialize user margin
            const userMargin = await db.transaction().execute(async (trx) => {
                logger.info('Transaction Started');

                // First check if user margin exists
                let margin = await trx
                    .selectFrom('user_margin')
                    .where('user_id', '=', userId)
                    .selectAll()
                    .executeTakeFirst();

                // If no margin record exists, initialize it
                if (!margin) {
                    const newMargin = {
                        user_id: userId,
                        cash_margin: 0,
                        pledge_margin: 0,
                        total_margin: 0,
                        available_margin: 0,
                        used_margin: 0,
                        created_at: new Date(),
                    };

                    margin = await trx.insertInto('user_margin').values(newMargin).returningAll().executeTakeFirst();
                }

                if (!margin) {
                    throw new Error('Failed to create or retrieve user margin');
                }

                // Get user's available funds
                const userFunds = await trx
                    .selectFrom('user_funds')
                    .where('user_id', '=', userId)
                    .selectAll()
                    .executeTakeFirst();

                // Update margin with latest funds data
                if (userFunds) {
                    // Convert values to numbers to avoid string concatenation issues
                    const cashMargin = Number(userFunds.available_funds);
                    const pledgeMargin = Number(margin.pledge_margin);
                    const usedMargin = Number(margin.used_margin);

                    const totalMargin = cashMargin + pledgeMargin;
                    const availableMargin = totalMargin - usedMargin;

                    // Update with explicit numeric values
                    margin = await trx
                        .updateTable('user_margin')
                        .set({
                            cash_margin: cashMargin,
                            total_margin: totalMargin,
                            available_margin: availableMargin,
                            updated_at: new Date(),
                        })
                        .where('user_id', '=', userId)
                        .returningAll()
                        .executeTakeFirst();

                    if (!margin) {
                        throw new Error('Failed to update user margin');
                    }
                }

                return margin;
            });
            logger.info('Transaction completed successfully');

            return res.status(200).json({
                success: true,
                data: userMargin,
            });
        } catch (error) {
            logger.error('Error fetching user margin:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user margin',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user collateral
     */
    async getUserCollateral(req: Request, res: Response): Promise<Response> {
        try {
            const userId = parseInt(req.params.userId, 10);

            const collateral = await db
                .selectFrom('user_collateral')
                .where('user_id', '=', userId)
                .where('status', '=', CollateralStatus.ACTIVE)
                .selectAll()
                .execute();

            return res.status(200).json({
                success: true,
                data: collateral,
            });
        } catch (error) {
            logger.error('Error fetching user collateral:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user collateral',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user orders
     */
    async getUserOrders(req: Request, res: Response): Promise<Response> {
        try {
            const userId = parseInt(req.params.userId, 10);
            const status = req.query.status as OrderStatus | undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

            let query = db.selectFrom('trading_orders').where('user_id', '=', userId);

            // Add status filter if provided
            if (status) {
                query = query.where('status', '=', status);
            }

            const orders = await query.orderBy('order_date', 'desc').limit(limit).offset(offset).selectAll().execute();

            return res.status(200).json({
                success: true,
                data: orders,
            });
        } catch (error) {
            logger.error('Error fetching user orders:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user orders',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get order by ID
     */
    async getOrderById(req: Request, res: Response): Promise<Response> {
        try {
            const orderId = parseInt(req.params.orderId, 10);

            const order = await db
                .selectFrom('trading_orders')
                .where('id', '=', orderId)
                .selectAll()
                .executeTakeFirst();

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found',
                });
            }

            return res.status(200).json({
                success: true,
                data: order,
            });
        } catch (error) {
            logger.error('Error fetching order:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch order',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Cancel order
     */
    async cancelOrder(req: Request, res: Response): Promise<Response> {
        try {
            const orderId = parseInt(req.params.orderId, 10);

            const result = await db.transaction().execute(async (trx) => {
                // Get order details
                const order = await trx
                    .selectFrom('trading_orders')
                    .where('id', '=', orderId)
                    .selectAll()
                    .executeTakeFirst();

                if (!order) {
                    throw new Error('Order not found');
                }

                // Check if order can be cancelled
                if (order.status !== OrderStatus.PENDING) {
                    throw new Error(`Cannot cancel order with status "${order.status}"`);
                }

                // Update order status
                const updatedOrder = await trx
                    .updateTable('trading_orders')
                    .set({
                        status: OrderStatus.CANCELLED,
                        updated_at: new Date(),
                    })
                    .where('id', '=', orderId)
                    .returningAll()
                    .executeTakeFirst();

                if (!updatedOrder) {
                    throw new Error('Failed to update order status');
                }

                // Release margin
                await trx
                    .updateTable('user_margin')
                    .set({
                        used_margin: (eb: any) => eb.ref('used_margin').subtract(order.margin_used),
                        available_margin: (eb: any) => eb.ref('available_margin').add(order.margin_used),
                        updated_at: new Date(),
                    })
                    .where('user_id', '=', order.user_id)
                    .execute();

                // If cash margin was used, release it
                if (order.margin_source === MarginSource.CASH || order.margin_source === MarginSource.BOTH) {
                    // Get user margin to calculate how much cash was used
                    const userMargin = await trx
                        .selectFrom('user_margin')
                        .where('user_id', '=', order.user_id)
                        .selectAll()
                        .executeTakeFirst();

                    if (userMargin) {
                        // Calculate cash margin portion
                        const cashMarginUsed =
                            order.margin_source === MarginSource.CASH
                                ? order.margin_used
                                : Math.min(order.margin_used, userMargin.cash_margin);

                        // Update user funds
                        await trx
                            .updateTable('user_funds')
                            .set({
                                used_funds: (eb: any) => eb.ref('used_funds').subtract(cashMarginUsed),
                                available_funds: (eb: any) => eb.ref('available_funds').add(cashMarginUsed),
                                updated_at: new Date(),
                            })
                            .where('user_id', '=', order.user_id)
                            .execute();
                    }
                }

                return updatedOrder;
            });

            // Notify user via WebSocket
            if (result && typeof result.user_id === 'number') {
                wsManager.sendMessage(result.user_id.toString(), {
                    type: 'ORDER_CANCELLED',
                    data: result,
                });
            }

            return res.status(200).json({
                success: true,
                data: result,
                message: 'Order cancelled successfully',
            });
        } catch (error) {
            logger.error('Error cancelling order:', error);

            // Handle specific errors
            if (error instanceof Error) {
                if (error.message === 'Order not found') {
                    return res.status(404).json({
                        success: false,
                        message: error.message,
                    });
                } else if (error.message.includes('Cannot cancel')) {
                    return res.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to cancel order',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user positions
     */
    async getUserPositions(req: Request, res: Response): Promise<Response> {
        try {
            const userId = parseInt(req.params.userId, 10);
            const tradeType = req.query.tradeType as TradeType | undefined;

            let query = db.selectFrom('trading_positions').where('user_id', '=', userId);

            // Add trade type filter if provided
            if (tradeType) {
                query = query.where('trade_type', '=', tradeType);
            }

            const positions = await query.selectAll().execute();

            return res.status(200).json({
                success: true,
                data: positions,
            });
        } catch (error) {
            logger.error('Error fetching user positions:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user positions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Square off position
     */
    async squareOffPosition(req: Request, res: Response): Promise<Response> {
        try {
            const positionId = parseInt(req.params.positionId, 10);

            const result = await db.transaction().execute(async (trx) => {
                // Get position details
                const position = await trx
                    .selectFrom('trading_positions')
                    .where('id', '=', positionId)
                    .selectAll()
                    .executeTakeFirst();

                if (!position) {
                    throw new Error('Position not found');
                }

                // Create opposite order to square off position
                const oppositeOrderSide = position.order_side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

                const orderData = {
                    user_id: position.user_id,
                    trade_type: position.trade_type,
                    order_side: oppositeOrderSide,
                    order_type: OrderType.MARKET, // Square off at market price
                    symbol: position.symbol,
                    quantity: position.quantity,
                    price: null, // Market order, no price needed
                    trigger_price: null,
                    status: OrderStatus.EXECUTED, // Immediately mark as executed for simplicity
                    margin_used: 0, // No additional margin required for square off
                    margin_source: position.margin_source,
                    order_date: new Date(),
                    execution_date: new Date(),
                    remarks: `Square off of position ID ${positionId}`,
                    created_at: new Date(),
                };

                const orderResult = await trx
                    .insertInto('trading_orders')
                    .values(orderData)
                    .returningAll()
                    .executeTakeFirst();

                if (!orderResult) {
                    throw new Error('Failed to create square off order');
                }

                // Release margin used by the position
                await trx
                    .updateTable('user_margin')
                    .set({
                        used_margin: (eb: any) => eb.ref('used_margin').subtract(position.margin_used),
                        available_margin: (eb: any) => eb.ref('available_margin').add(position.margin_used),
                        updated_at: new Date(),
                    })
                    .where('user_id', '=', position.user_id)
                    .execute();

                // If cash margin was used, release it
                if (position.margin_source === MarginSource.CASH || position.margin_source === MarginSource.BOTH) {
                    // Get user margin to calculate how much cash was used
                    const userMargin = await trx
                        .selectFrom('user_margin')
                        .where('user_id', '=', position.user_id)
                        .selectAll()
                        .executeTakeFirst();

                    if (userMargin) {
                        // Calculate cash margin portion
                        const cashMarginUsed =
                            position.margin_source === MarginSource.CASH
                                ? position.margin_used
                                : Math.min(position.margin_used, userMargin.cash_margin);

                        // Update user funds
                        await trx
                            .updateTable('user_funds')
                            .set({
                                used_funds: (eb: any) => eb.ref('used_funds').subtract(cashMarginUsed),
                                available_funds: (eb: any) => eb.ref('available_funds').add(cashMarginUsed),
                                updated_at: new Date(),
                            })
                            .where('user_id', '=', position.user_id)
                            .execute();
                    }
                }

                // Delete the position as it's closed now
                await trx.deleteFrom('trading_positions').where('id', '=', positionId).execute();

                return {
                    order: orderResult,
                    position,
                };
            });

            // Notify user via WebSocket
            if (result && result.position && typeof result.position.user_id === 'number') {
                wsManager.sendMessage(result.position.user_id.toString(), {
                    type: 'POSITION_SQUARED_OFF',
                    data: result,
                });
            }

            return res.status(200).json({
                success: true,
                data: result,
                message: 'Position squared off successfully',
            });
        } catch (error) {
            logger.error('Error squaring off position:', error);

            // Handle specific errors
            if (error instanceof Error) {
                if (error.message === 'Position not found') {
                    return res.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to square off position',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Process M2M losses and adjust margins
     */
    async processM2MLossesAndMargins(req: Request, res: Response): Promise<Response> {
        try {
            const userId = parseInt(req.params.userId, 10);

            const result = await db.transaction().execute(async (trx) => {
                // Get user's F&O positions
                const foPositions = await trx
                    .selectFrom('trading_positions')
                    .where('user_id', '=', userId)
                    .where('trade_type', 'in', [TradeType.EQUITY_FUTURES, TradeType.EQUITY_OPTIONS])
                    .selectAll()
                    .execute();

                let totalM2MLoss = 0;

                // Calculate total M2M loss
                for (const position of foPositions) {
                    if (position.mtm_loss > 0) {
                        totalM2MLoss += position.mtm_loss;
                    }
                }

                if (totalM2MLoss > 0) {
                    // Calculate 5% margin cut
                    const marginCut = totalM2MLoss * 0.05;

                    // Update user margin
                    await trx
                        .updateTable('user_margin')
                        .set({
                            available_margin: (eb: any) => eb.ref('available_margin').subtract(marginCut),
                            blocked_margin: (eb: any) => eb.ref('blocked_margin').add(marginCut),
                            updated_at: new Date(),
                        })
                        .where('user_id', '=', userId)
                        .execute();

                    // Create margin cut transaction record
                    const transactionData = {
                        user_id: userId,
                        transaction_type: TransactionType.MARGIN_CUT,
                        amount: marginCut,
                        reason: 'M2M Loss margin cut (5%)',
                        created_at: new Date(),
                    };

                    const marginCutRecord = await trx
                        .insertInto('margin_transactions')
                        .values(transactionData)
                        .returningAll()
                        .executeTakeFirst();

                    if (!marginCutRecord) {
                        throw new Error('Failed to create margin cut transaction record');
                    }

                    // Notify user via WebSocket
                    wsManager.sendMessage(userId.toString(), {
                        type: 'MARGIN_CUT_APPLIED',
                        data: {
                            marginCut,
                            totalM2MLoss,
                            marginCutRecord,
                        },
                    });

                    return {
                        marginCut,
                        totalM2MLoss,
                        marginCutRecord,
                    };
                }

                return null;
            });

            return res.status(200).json({
                success: true,
                data: result,
                message: result ? 'Margin cut applied successfully' : 'No M2M losses to process',
            });
        } catch (error) {
            logger.error('Error processing M2M losses:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process M2M losses',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}

// Create and export singleton instance
export const tradingController = new TradingController();
