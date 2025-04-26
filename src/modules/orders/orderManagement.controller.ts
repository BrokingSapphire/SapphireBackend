// orderManagement.controller.ts

import { Request, Response } from 'express';
import { db } from '@app/database';
import { BadRequestError, NotFoundError } from '@app/apiError';
import { OrderSide, ProductType, OrderType, OrderStatus, OrderValidity, OrderCategory } from './order.types';
import {
    InstantOrderRequest,
    OrderAttemptFailure,
    NormalOrderRequest,
    IcebergOrderRequest,
    CoverOrderRequest,
} from '@app/database/db';
import { calculateCharges } from '../charges/charges.service';
import { ChargesDirection, ExchangeType } from '../charges/charges.types';
import generateOrderId from './orderIdGenerator';
import logger from '@app/logger';
import { OK, CREATED } from '@app/utils/httpstatus';

const calculateOrderCharges = async (
    orderId: number,
    quantity: number,
    price: number,
    orderSide: OrderSide,
    productType: ProductType,
    exchange: ExchangeType = ExchangeType.NSE, // NSE --> Default for now
): Promise<number> => {
    let direction: ChargesDirection;
    switch (orderSide) {
        case OrderSide.BUY:
            direction = ChargesDirection.BUY;
            break;
        case OrderSide.SELL:
            direction = ChargesDirection.SELL;
            break;
        default:
            direction = ChargesDirection.BUY;
    }

    // Calculate charges
    const chargesResult = await calculateCharges(orderId, quantity, price, direction, exchange, productType);

    return chargesResult.total_charges;
};

// Creating Instant Order

const createInstantOrder = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }
    const {
        symbol,
        orderSide,
        quantity,
        price,
        productType,
        orderType,
        exchange = ExchangeType.NSE,
    }: InstantOrderRequest & { exchange?: ExchangeType } = req.body;

    if (!symbol || !orderSide || !quantity || !productType || !orderType) {
        throw new BadRequestError('Missing required fields');
    }

    if (orderType !== OrderType.MARKET_ORDER && orderType !== OrderType.LIMIT_ORDER) {
        throw new BadRequestError('Invalid order type');
    }

    // for limit order --> price is required

    if (orderType === OrderType.LIMIT_ORDER && !price) {
        throw new BadRequestError('Price is required for limit orders');
    }

    // check for users avlbl funds
    const userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirst();

    if (!userFunds) {
        throw new NotFoundError('User funds not found');
    }

    // get estimate value

    const estimatePrice: number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue: number = estimatePrice * quantity;

    const generatedOrderId = await generateOrderId(db);

    // Calculate trading charges
    const tradingCharges = await calculateOrderCharges(
        Number(generatedOrderId),
        quantity,
        estimatePrice,
        orderSide as OrderSide,
        productType as ProductType,
        exchange as ExchangeType,
    );

    // For margin products, apply appropriate margin requirement

    let requiredFunds: number = estimatedValue;
    if (productType === ProductType.INTRADAY) {
        requiredFunds = estimatedValue * 0.2; // 20% margin for intraday
    } else if (productType === ProductType.MTF) {
        requiredFunds = estimatedValue * 0.4; // 40% margin for MTF
    }
    requiredFunds += tradingCharges;

    // Check if sufficient funds
    if (userFunds.available_funds < requiredFunds) {
        // Log the failed attempt
        await db.transaction().execute(async (tx) => {
            await tx
                .insertInto('order_attempt_failures')
                .values({
                    user_id: userId,
                    order_category: OrderCategory.INSTANT,
                    order_reference_id: generatedOrderId,
                    symbol,
                    order_side: orderSide,
                    quantity,
                    price: price || estimatePrice,
                    product_type: 'delivery', // Default for normal orders
                    order_type: orderType,
                    failure_reason: 'Insufficient funds',
                    required_funds: requiredFunds,
                    available_funds: userFunds.available_funds || 0,
                    attempted_at: new Date(),
                } as OrderAttemptFailure)
                .onConflict((oc) => oc.constraint('uq_instant_orders_order_id').doNothing())
                .execute();

            throw new BadRequestError(
                `Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds.available_funds}`,
            );
        });
    }

    // Creating order in transaction

    const result = await db.transaction().execute(async (trx) => {
        // creating entry in main order table
        const order = await trx
            .insertInto('orders')
            .values({
                user_id: userId,
                order_category: OrderCategory.INSTANT,
                order_reference_id: generatedOrderId, // needs to add in db
                symbol,
                order_side: orderSide,
                quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date(),
                exchange,
                total_charges: tradingCharges,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // creating entry in order details table
        const instantOrder = await trx
            .insertInto('instant_orders')
            .values({
                order_id: order!.id,
                product_type: productType,
                order_type: orderType,
            })
            .onConflict((oc) => oc.constraint('uq_instant_orders_order_id').doNothing())
            .returningAll()
            .executeTakeFirstOrThrow();

        // deducting user funds

        await trx
            .updateTable('user_funds')
            .set({
                available_funds: (eb) => eb('available_funds', '-', requiredFunds),
                used_funds: (eb) => eb('used_funds', '+', requiredFunds),
                updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .execute();

        return {
            order,
            instantOrder,
            orderReferenceId: generatedOrderId,
            fundsImpact: {
                required: requiredFunds,
                tradingValue: estimatedValue,
                tradingCharges,
                remainingFunds: userFunds.available_funds - requiredFunds,
            },
        };
    });

    logger.info(`Instant order created successfully for user ${userId}, Order ID: ${generatedOrderId}`);

    res.status(CREATED).json({
        Message: 'Instant Order Created Successfully',
        data: result,
    });
};

// creating normal order

const createNormalOrder = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid User ID');
    }

    const {
        symbol,
        orderSide,
        quantity,
        price,
        orderType,
        triggerPrice,
        validity,
        validityMinutes,
        disclosedQuantity,
        exchange = ExchangeType.NSE,
    }: NormalOrderRequest & { exchange?: ExchangeType } = req.body;

    if (!userId || !orderSide || !quantity || !orderType || !validity) {
        throw new BadRequestError('Missing Fields are Required');
    }

    // Limit-type order --> Price is Required

    if (orderType === OrderType.LIMIT_ORDER && !price) {
        throw new BadRequestError('Price is Required for Limit order');
    }

    // for stop-loss order  --> Triggered Price is Required

    if (orderType === OrderType.SL || orderType === OrderType.SL_M) {
        throw new BadRequestError('Triggered Price is Required for Stop-loss orders');
    }

    // check for validity

    if (validity === OrderValidity.MINUTES && (!validityMinutes || validityMinutes <= 0)) {
        throw new BadRequestError('Valid Minutes are Required to place order');
    }

    // check for users avlbl funds

    const userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirst();

    if (!userFunds) {
        throw new NotFoundError('User Funds not found');
    }

    // get estimate value

    const estimatePrice: number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue: number = estimatePrice * quantity;

    const productType = ProductType.DELIVERY;

    // generateOrderID:
    const generatedOrderId = await generateOrderId(db);

    // Calculate trading charges
    const tradingCharges = await calculateOrderCharges(
        Number(generatedOrderId),
        quantity,
        estimatePrice,
        orderSide as OrderSide,
        productType as ProductType,
        exchange as ExchangeType,
    );
    // normal orders,  100% margin is required
    const requiredFunds: number = estimatedValue + tradingCharges;

    // checking if user has sufficient funds
    if (userFunds.available_funds < requiredFunds) {
        // Log the failed attempt
        await db.transaction().execute(async (trx) => {
            await trx
                .insertInto('order_attempt_failures')
                .values({
                    user_id: userId,
                    order_category: OrderCategory.NORMAL,
                    order_reference_id: generatedOrderId,
                    symbol,
                    order_side: orderSide,
                    quantity,
                    price: price || estimatePrice,
                    product_type: 'delivery',
                    order_type: orderType,
                    failure_reason: 'Insufficient funds',
                    required_funds: requiredFunds,
                    available_funds: userFunds.available_funds || 0,
                    attempted_at: new Date(),
                } as OrderAttemptFailure)
                .onConflict((oc) => oc.constraint('uq_order_attempt_failures').doNothing())
                .execute();
            throw new BadRequestError(
                `Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds.available_funds}`,
            );
        });
    }

    // Creating order in transaction

    const result = await db.transaction().execute(async (trx) => {
        // creating entry in main order table
        const order = await trx
            .insertInto('orders')
            .values({
                user_id: userId,
                order_category: OrderCategory.NORMAL,
                order_reference_id: generatedOrderId,
                symbol,
                order_side: orderSide,
                quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date(),
                exchange,
                total_charges: tradingCharges,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // creating entry in order details table
        const normalOrder = await trx
            .insertInto('normal_orders')
            .values({
                order_id: order!.id,
                order_type: orderType,
                trigger_price: triggerPrice || null,
                validity,
                validity_minutes: validity === OrderValidity.MINUTES ? validityMinutes : null,
                disclosed_quantity: disclosedQuantity || null,
            })
            .onConflict((oc) => oc.constraint('uq_iceberg_orders_order_id').doNothing())
            .returningAll()
            .executeTakeFirstOrThrow();

        // deducting user funds

        await trx
            .updateTable('user_funds')
            .set({
                available_funds: (eb) => eb('available_funds', '-', requiredFunds),
                used_funds: (eb) => eb('used_funds', '+', requiredFunds),
                updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .execute();

        return {
            order,
            normalOrder,
            orderReferenceId: generatedOrderId,
            fundsImpact: {
                required: requiredFunds,
                tradingValue: estimatedValue,
                tradingCharges,
                remainingFunds: userFunds.available_funds - requiredFunds,
            },
        };
    });

    logger.info(`Normal order successfully created for user ${userId}`);

    res.status(CREATED).json({
        message: 'Normal Order Created Successfully',
        data: result,
    });
};

// Create Iceberg Order

const createIcebergOrder = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid User ID');
    }
    const {
        symbol,
        orderSide,
        quantity,
        price,
        orderType,
        triggerPrice,
        validity,
        validityMinutes,
        disclosedQuantity,
        numOfLegs,
        productType,
        exchange = ExchangeType.NSE,
    }: IcebergOrderRequest & { exchange?: ExchangeType } = req.body;
    if (!symbol || !orderSide || !quantity || !orderType || !validity) {
        throw new BadRequestError('Missing Fields are Required');
    }
    // Limit-type order --> Price is Required
    if (productType !== ProductType.INTRADAY && productType !== ProductType.DELIVERY) {
        throw new BadRequestError('Invalid product type');
    }

    if (orderType === OrderType.LIMIT_ORDER && !price) {
        throw new BadRequestError('Price is Required for Limit order');
    }
    // for stop-loss order  --> Triggered Price is Required
    if ((orderType === OrderType.SL || orderType === OrderType.SL_M) && !triggerPrice) {
        throw new BadRequestError('Triggered Price is Required for Stop-loss orders');
    }

    // check for validity
    if (validity === OrderValidity.MINUTES && (!validityMinutes || validityMinutes <= 0)) {
        throw new BadRequestError('Valid Minutes are Required to place order');
    }
    // check for the number of legs

    if (numOfLegs <= 0) {
        throw new BadRequestError('Number of legs should be greater than 0');
    }

    // disclosed Qty check
    if (disclosedQuantity <= 0 || disclosedQuantity > quantity) {
        throw new BadRequestError('Disclosed quantity should be greater than 0');
    }

    // check for avlbl funds
    const userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirstOrThrow();

    // get estimate value
    const estimatePrice: number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue: number = estimatePrice * quantity;

    const generatedOrderId = await generateOrderId(db);

    // Calculate trading charges
    const tradingCharges = await calculateOrderCharges(
        Number(generatedOrderId),
        quantity,
        estimatePrice,
        orderSide as OrderSide,
        productType as ProductType,
        exchange as ExchangeType,
    );

    // calculate funds
    let requiredFunds: number;

    if (productType === ProductType.INTRADAY) {
        requiredFunds = estimatedValue * 0.2; // 20% margin for intraday
    } else {
        requiredFunds = estimatedValue; // for delivery 100% margin utilization
    }
    requiredFunds += tradingCharges;

    // checking if user has sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
        // log the failed attempt

        await db.transaction().execute(async (trx) => {
            await trx
                .insertInto('order_attempt_failures')
                .values({
                    user_id: userId,
                    order_category: OrderCategory.ICEBERG,
                    order_reference_id: generatedOrderId,
                    symbol,
                    order_side: orderSide,
                    quantity,
                    price: price || estimatePrice,
                    product_type: productType,
                    order_type: orderType,
                    failure_reason: 'Insufficient funds',
                    required_funds: requiredFunds,
                    available_funds: userFunds.available_funds || 0,
                    attempted_at: new Date(),
                } as OrderAttemptFailure)
                .onConflict((oc) => oc.constraint('uq_iceberg_orders_order_id').doNothing())
                .execute();

            throw new BadRequestError(
                `Insufficient funds to place this order. Order ID: ${generatedOrderId}, Required: ${requiredFunds}, Available: ${userFunds?.available_funds}`,
            );
        });
    }

    // Create order in transaction
    const result = await db.transaction().execute(async (trx) => {
        // First create the main order record
        const order = await trx
            .insertInto('orders')
            .values({
                user_id: userId,
                order_category: OrderCategory.ICEBERG,
                order_reference_id: generatedOrderId,
                symbol,
                order_side: orderSide,
                quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date(),
                exchange,
                total_charges: tradingCharges,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Create the iceberg order details
        const icebergOrder = await trx
            .insertInto('iceberg_orders')
            .values({
                order_id: order!.id,
                num_of_legs: numOfLegs,
                order_type: orderType,
                product_type: productType,
                trigger_price: triggerPrice || null,
                validity,
                validity_minutes: validity === OrderValidity.MINUTES ? validityMinutes : null,
                disclosed_quantity: disclosedQuantity,
            })
            .onConflict((oc) => oc.constraint('uq_iceberg_orders_order_id').doNothing())
            .returningAll()
            .executeTakeFirstOrThrow();

        // Create legs
        const legQuantity: number = Math.floor(quantity / numOfLegs);
        const legs = [];

        for (let i = 0; i < numOfLegs; i++) {
            // Adjust last leg quantity to account for rounding
            const actualLegQuantity: number =
                i === numOfLegs - 1 ? quantity - legQuantity * (numOfLegs - 1) : legQuantity;

            const leg = await trx
                .insertInto('iceberg_legs')
                .values({
                    iceberg_order_id: order!.id,
                    leg_number: i + 1,
                    quantity: actualLegQuantity,
                    status: i === 0 ? OrderStatus.QUEUED : OrderStatus.PENDING,
                })
                .returningAll()
                .executeTakeFirst();

            legs.push(leg);
        }
        // Deduct the required funds from the user's available funds
        await trx
            .updateTable('user_funds')
            .set({
                available_funds: (eb) => eb('available_funds', '-', requiredFunds),
                used_funds: (eb) => eb('used_funds', '+', requiredFunds),
                updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .execute();

        return {
            orderId: order.id,
            orderReferenceId: generatedOrderId,
            status: order.status,
            numOfLegs: legs.length,
            fundDetails: {
                requiredFunds,
                tradingValue: estimatedValue,
                tradingCharges,
                remainingFunds: userFunds.available_funds - requiredFunds,
            },
        };
    });

    logger.info(`Iceberg order successfully created for user ${userId}, Order ID: ${result.orderReferenceId}`);

    res.status(CREATED).json({
        Message: 'Iceberg Order Created Successfully',
        data: result,
    });
};

// creating cover order

const createCoverOrder = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid User ID');
    }
    const {
        symbol,
        orderSide,
        quantity,
        price,
        orderType,
        stopLossPrice,
        exchange = ExchangeType.NSE,
    }: CoverOrderRequest & { exchange?: ExchangeType } = req.body;

    // Validate required fields
    if (!symbol || !orderSide || !quantity || !orderType || !stopLossPrice) {
        throw new BadRequestError('Missing required fields for cover order');
    }

    if (orderType !== OrderType.MARKET_ORDER && orderType !== OrderType.LIMIT_ORDER) {
        throw new BadRequestError('Invalid order type');
    }

    // For limit orders, price is required
    if (orderType === OrderType.LIMIT_ORDER && !price) {
        throw new BadRequestError('Price is required for limit orders');
    }

    // Validate stop loss price
    if (orderSide === OrderSide.BUY && stopLossPrice >= (price || 0)) {
        throw new BadRequestError('For buy orders, stop loss price must be less than the price');
    }

    if (orderSide === OrderSide.SELL && stopLossPrice <= (price || Number.MAX_SAFE_INTEGER)) {
        throw new BadRequestError('For sell orders, stop loss price must be greater than the price');
    }

    // check for the users funds

    const userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirst();
    if (!userFunds) {
        throw new NotFoundError('User funds not found');
    }
    // get estimate value
    const estimatePrice: number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue: number = estimatePrice * quantity;

    // Generate order ID
    const generatedOrderId = await generateOrderId(db);

    // Cover orders are always intraday
    const productType = ProductType.INTRADAY;

    const mainOrderCharges = await calculateOrderCharges(
        Number(generatedOrderId),
        quantity,
        estimatePrice,
        orderSide as OrderSide,
        productType as ProductType,
        exchange as ExchangeType,
    );

    // Calculate stop loss order charges (will execute in opposite direction)
    const stopLossOrderSide = orderSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
    const stopLossOrderCharges = await calculateOrderCharges(
        Number(generatedOrderId) + 1,
        quantity,
        stopLossPrice,
        stopLossOrderSide,
        productType,
        exchange,
    );

    // Total charges for both orders
    const totalCharges = mainOrderCharges + stopLossOrderCharges;

    // Cover orders require less margin (20% + charges)
    const requiredFunds: number = estimatedValue * 0.2 + totalCharges;

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
        // Log the failed attempt
        await db.transaction().execute(async (tx) => {
            await tx
                .insertInto('order_attempt_failures')
                .values({
                    user_id: userId,
                    order_category: OrderCategory.COVER_ORDER,
                    order_reference_id: generatedOrderId,
                    symbol,
                    order_side: orderSide,
                    quantity,
                    price: price || estimatePrice,
                    product_type: ProductType.INTRADAY,
                    order_type: orderType,
                    failure_reason: 'Insufficient funds',
                    required_funds: requiredFunds,
                    available_funds: userFunds?.available_funds || 0,
                    attempted_at: new Date(),
                } as OrderAttemptFailure)
                .onConflict((oc) => oc.constraint('uq_order_attempt_failures').doNothing())
                .execute();

            throw new BadRequestError(
                `Insufficient funds to place this order. Order ID: ${generatedOrderId}, Required: ${requiredFunds}, Available: ${userFunds?.available_funds}`,
            );
        });
    }

    // Create order in transaction
    const result = await db.transaction().execute(async (trx) => {
        // First create the main order record
        const order = await trx
            .insertInto('orders')
            .values({
                user_id: userId,
                order_category: OrderCategory.COVER_ORDER,
                order_reference_id: generatedOrderId,
                symbol,
                order_side: orderSide,
                quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date(),
                exchange,
                total_charges: totalCharges,
            })
            .returningAll()
            .executeTakeFirst();

        // Create the cover order details
        const coverOrder = await trx
            .insertInto('cover_orders')
            .values({
                order_id: order!.id,
                stop_loss_price: stopLossPrice,
                order_type: orderType,
            })
            .onConflict((oc) =>
                oc.constraint('uq_cover_orders_order_id').doUpdateSet((eb) => ({
                    stop_loss_price: eb.ref('excluded.stop_loss_price'),
                    order_type: eb.ref('excluded.order_type'),
                })),
            )
            .returningAll()
            .executeTakeFirstOrThrow();

        // Create cover order details tracking both main and stop-loss orders
        const coverOrderDetails = await trx
            .insertInto('cover_order_details')
            .values({
                cover_order_id: order!.id,
                main_order_status: OrderStatus.QUEUED,
                stop_loss_order_status: OrderStatus.QUEUED,
            })
            .onConflict((oc) =>
                oc.constraint('uq_cover_order_details_cover_order_id').doUpdateSet((eb) => ({
                    main_order_status: eb.ref('excluded.main_order_status'),
                    stop_loss_order_status: eb.ref('excluded.stop_loss_order_status'),
                })),
            )
            .returningAll()
            .executeTakeFirstOrThrow();

        // Deduct the required funds from the user's available funds
        await trx
            .updateTable('user_funds')
            .set({
                available_funds: (eb) => eb('available_funds', '-', requiredFunds),
                used_funds: (eb) => eb('used_funds', '+', requiredFunds),
                updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .execute();

        return {
            order,
            coverOrder,
            coverOrderDetails,
            orderReferenceId: generatedOrderId,
            chargesDetails: {
                mainOrderCharges,
                stopLossOrderCharges,
                totalCharges,
                tradingValue: estimatedValue,
                requiredFunds,
            },
        };
    });

    logger.info(`Cover order successfully created for user ${userId}, Order ID: ${result.orderReferenceId}`);

    res.status(CREATED).json({
        Message: 'Cover Order Created Successfully',
        data: result,
    });
};

// ########################################################################################

// Helper function to get estimated market price
function getEstimatedMarketPrice(symbol: string): number {
    // In a real implementation, you would call a market data API
    // For this example, we'll use a mock implementation

    // Sample price mapping
    const prices: Record<string, number> = {
        RELIANCE: 2500,
        INFY: 1500,
        TCS: 3200,
        HDFCBANK: 1650,
        TATASTEEL: 120,
    };

    // Return price or default
    return prices[symbol] || 1000; // Default price if symbol not found
}

// #################################################################################
// get All Orders

const getAllOrders = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid User ID');
    }

    const status = req.query.status as OrderStatus | undefined;
    const category = req.query.category as OrderCategory | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    // Pagination handling
    const pageSize: number = limit;
    const currentPage: number = page;
    const offset: number = (currentPage - 1) * pageSize;

    // Create a function that returns a base query with all conditions
    const createBaseQuery = () =>
        db
            .selectFrom('orders')
            .where('user_id', '=', userId)
            .$if(status !== undefined, (qb) => qb.where('status', '=', status as any))
            .$if(category !== undefined, (qb) => qb.where('order_category', '=', category as OrderCategory));

    // Create separate queries for count and data
    const countResult = await createBaseQuery().select(db.fn.count('id').as('total')).executeTakeFirst();

    const total: number = countResult && 'total' in countResult ? Number(countResult.total) : 0;

    // Get orders with pagination
    const orders = await createBaseQuery()
        .orderBy('placed_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .selectAll()
        .execute();

    res.status(OK).json({
        data: {
            orders,
            pagination: {
                total,
                page: currentPage,
                pageSize,
                pages: Math.ceil(total / pageSize),
            },
        },
    });
};

// get-order-details by ID

const getOrderById = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.order_id, 10);

    if (isNaN(orderId)) {
        throw new BadRequestError('Invalid Order ID');
    }

    // getting order

    const order = await db.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst();

    if (!order) {
        throw new NotFoundError('Order not found');
    }
    let orderDetails = null;
    let additionalDetails = null;

    // using switch-case

    switch (order.order_category) {
        case OrderCategory.INSTANT:
            orderDetails = await db
                .selectFrom('instant_orders')
                .where('order_id', '=', orderId)
                .selectAll()
                .executeTakeFirst();
            break;

        case OrderCategory.NORMAL:
            orderDetails = await db
                .selectFrom('normal_orders')
                .where('order_id', '=', orderId)
                .selectAll()
                .executeTakeFirst();
            break;
        case OrderCategory.ICEBERG:
            orderDetails = await db
                .selectFrom('iceberg_orders')
                .where('order_id', '=', orderId)
                .selectAll()
                .executeTakeFirst();

            // for iceberg-get legs

            additionalDetails = await db
                .selectFrom('iceberg_legs')
                .where('iceberg_order_id', '=', orderId)
                .selectAll()
                .execute();
            break;

        case OrderCategory.COVER_ORDER:
            orderDetails = await db
                .selectFrom('cover_orders')
                .where('order_id', '=', orderId)
                .selectAll()
                .executeTakeFirst();

            // Get cover order details
            additionalDetails = await db
                .selectFrom('cover_order_details')
                .where('cover_order_id', '=', orderId)
                .selectAll()
                .executeTakeFirst();
            break;
    }
    res.status(OK).json({
        success: true,
        data: {
            order,
            orderDetails,
            additionalDetails: additionalDetails || undefined,
        },
    });
};

// get cancel-orders
const cancelOrder = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.order_id, 10);

    if (isNaN(orderId)) {
        throw new BadRequestError('Invalid order ID');
    }

    // Execute the transaction
    const result = await db.transaction().execute(async (trx) => {
        // Get the order
        const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst();

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Check if order can be cancelled
        if (order.status !== OrderStatus.QUEUED) {
            throw new BadRequestError(`Cannot cancel order with status "${order.status}"`);
        }

        // Update order status
        const updatedOrder = await trx
            .updateTable('orders')
            .set({
                status: OrderStatus.CANCELLED,
                cancelled_at: new Date(),
            })
            .where('id', '=', orderId)
            .returningAll()
            .executeTakeFirstOrThrow();

        // Handle special cases for different order types
        switch (order.order_category) {
            case OrderCategory.ICEBERG:
                // Update all queued legs
                await trx
                    .updateTable('iceberg_legs')
                    .set({
                        status: OrderStatus.CANCELLED,
                        cancelled_at: new Date(),
                    })
                    .where('iceberg_order_id', '=', orderId)
                    .where('status', '=', OrderStatus.QUEUED)
                    .execute();
                break;

            case OrderCategory.COVER_ORDER:
                // Update cover order details
                await trx
                    .updateTable('cover_order_details')
                    .set({
                        main_order_status: OrderStatus.CANCELLED,
                        stop_loss_order_status: OrderStatus.CANCELLED,
                    })
                    .where('cover_order_id', '=', orderId)
                    .execute();
                break;
        }

        // Create order history record
        await trx
            .insertInto('order_history')
            .values({
                order_id: orderId,
                previous_status: OrderStatus.QUEUED,
                new_status: OrderStatus.CANCELLED,
                changed_at: new Date(),
                remarks: 'Order cancelled by user',
                changed_by: 'user',
            })
            .execute();

        return updatedOrder;
    });
    res.status(OK).json({
        data: result,
        message: 'Order cancelled successfully',
    });
};

// get-order-history

const getOrderHistory = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.order_id, 10);

    if (isNaN(orderId)) {
        throw new BadRequestError('Invalid order ID');
    }

    // Check if order exists
    const order = await db
        .selectFrom('orders')
        .where('id', '=', orderId)
        .select(['id', 'status', 'symbol', 'quantity', 'price', 'order_side', 'order_category'])
        .executeTakeFirstOrThrow();

    // Get order history
    const history = await db
        .selectFrom('order_history')
        .where('order_id', '=', orderId)
        .orderBy('changed_at', 'asc')
        .select(['previous_status', 'new_status', 'changed_at', 'remarks', 'changed_by'])
        .execute();

    res.status(OK).json({
        success: true,
        data: {
            order,
            history,
        },
    });
};

// get-recent-orders

const getRecentOrders = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }

    const limit: number = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

    const recentOrders = await db
        .selectFrom('orders')
        .where('user_id', '=', userId)
        .orderBy('placed_at', 'desc')
        .limit(limit)
        .selectAll()
        .execute();

    res.status(OK).json({
        success: true,
        data: recentOrders,
    });
};

// failed-orders-attempt

const getFailedOrderAttempts = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id, 10);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }

    const page: number = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit: number = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    // Pagination
    const pageSize: number = limit;
    const currentPage: number = page;
    const offset: number = (currentPage - 1) * pageSize;

    const countQuery = db.selectFrom('order_attempt_failures').where('user_id', '=', userId);

    // Select count
    const totalResult = await countQuery.select(db.fn.count('id').as('total')).executeTakeFirst();

    // Parse count result
    const total: number = totalResult && 'total' in totalResult ? Number(totalResult.total) : 0;
    // Get failed attempts with pagination
    const failedAttempts = await db
        .selectFrom('order_attempt_failures')
        .where('user_id', '=', userId)
        .orderBy('attempted_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .selectAll()
        .execute();

    res.status(OK).json({
        success: true,
        data: {
            failedAttempts,
            pagination: {
                total,
                page: currentPage,
                pageSize,
                pages: Math.ceil(total / pageSize),
            },
        },
    });
};

const getQueuedOrders = async (req: Request, res: Response): Promise<void> => {
    req.query.status = 'QUEUED';
    return getAllOrders(req, res);
};

const getExecutedOrders = async (req: Request, res: Response): Promise<void> => {
    req.query.status = 'EXECUTED';
    return getAllOrders(req, res);
};

const getCancelledOrders = async (req: Request, res: Response): Promise<void> => {
    req.query.status = 'CANCELLED';
    return getAllOrders(req, res);
};

const getRejectedOrders = async (req: Request, res: Response): Promise<void> => {
    req.query.status = 'REJECTED';
    return getAllOrders(req, res);
};

export const orderManagementController = {
    createInstantOrder,
    createNormalOrder,
    createIcebergOrder,
    createCoverOrder,
    getAllOrders,
    getOrderById,
    cancelOrder,
    getOrderHistory,
    getRecentOrders,
    getFailedOrderAttempts,
    getQueuedOrders,
    getExecutedOrders,
    getCancelledOrders,
    getRejectedOrders,
};
