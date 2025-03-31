// orderManagement.controller.ts

import { Request, Response } from 'express';
import {db} from '@app/database';
import { APIError, BadRequestError, NotFoundError } from '@app/apiError';
import { 
    OrderSide, 
    ProductType, 
    OrderType, 
    OrderStatus,
    OrderValidity,
    OrderCategory,
    InstantOrderRequest,
    NormalOrderRequest,
    IcebergOrderRequest,
    CoverOrderRequest,
    OrderAttemptFailure
} from './order.types';
import logger from '@app/logger';
import {OK, CREATED} from '@app/utils/httpstatus';

// Creating Instant Order

const createInstantOrder = async (req: Request, res: Response): Promise<void> => {
    const userId:number = parseInt(req.params.userId);

    if(isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }
    const {  symbol,
    orderSide,
    quantity,
    price,
    productType,
    orderType } : InstantOrderRequest = req.body;

    if(!symbol || !orderSide || !quantity || !productType || !orderType) {
        throw new BadRequestError('Missing required fields');
    }

    if (!Object.values(productType).includes(productType)) {
        throw new BadRequestError('Invalid product type');
    }

    if (orderType !== OrderType.MARKET_ORDER && orderType !== OrderType.LIMIT_ORDER) {
        throw new BadRequestError('Invalid order type');
    }

    // for limit order --> price is required

    if (orderType === OrderType.LIMIT_ORDER && !price) {
        throw new BadRequestError('Price is required for limit orders');
    }

    // check for users avlbl funds
    let userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirst();

    if (!userFunds) {
        throw new NotFoundError('User funds not found');
    }
    
    // get estimate value

    const estimatePrice:number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue:number = estimatePrice * quantity;

    // For margin products, apply appropriate margin requirement

    let requiredFunds: number = estimatedValue;
    if(productType === ProductType.INTRADAY){
        requiredFunds = estimatedValue * 0.2; // 20% margin for intraday
    }
    else if(productType === ProductType.MTF){
        requiredFunds = estimatedValue * 0.4; // 40% margin for MTF
    }

    // Check if sufficient funds 
if (userFunds.available_funds < requiredFunds) { 
    // Log the failed attempt 
    await db.transaction().execute(async (tx) => {
        await tx
            .insertInto('order_attempt_failures')
            .values({
                user_id: userId, 
                order_category: OrderCategory.NORMAL, 
                symbol: symbol, 
                order_side: orderSide, 
                quantity: quantity, 
                price: price || estimatePrice, 
                product_type: 'delivery', // Default for normal orders 
                order_type: orderType, 
                failure_reason: 'Insufficient funds', 
                required_funds: requiredFunds, 
                available_funds: userFunds.available_funds || 0, 
                attempted_at: new Date()
            } as OrderAttemptFailure)
            .execute();
            
        throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds.available_funds}`);
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
        symbol: symbol,
        order_side: orderSide,
        quantity: quantity,
        price: price || null,
        status: OrderStatus.QUEUED,
        placed_at: new Date()
    })
    .returningAll()
    .executeTakeFirst();

    // creating entry in order details table
    const instantOrder = await trx
    .insertInto('instant_orders')
    .values({
        order_id: order!.id,
        product_type: productType,
        order_type: orderType,
    })
    .returningAll()
    .executeTakeFirst();

    // deducting user funds

    await trx
    .updateTable('user_funds')
    .set({
        available_funds: eb => eb('available_funds', '-', requiredFunds),
        used_funds: eb => eb('used_funds', '+', requiredFunds),
        updated_at: new Date()
    })
    .where('user_id', '=', userId)
    .execute();

    return {
        order,
        instantOrder,
        fundsImpact: {
        required: requiredFunds,
        remainingFunds: userFunds.available_funds - requiredFunds
        }
    };
});

logger.info(`Instant order created successfully for user ${userId}`);

res.status(CREATED).json({
    Message:"Instant Order Created Successfully",
    data: result
})
};


// creating normal order

const createNormalOrder = async (req:Request, res: Response): Promise<void> =>{
    const userId: number = parseInt(req.params.user_id);

    if(isNaN(userId)){
        throw new BadRequestError("Invalid User ID");
    }

    const {symbol, 
        orderSide,
        quantity,
        price,
        orderType,
        triggerPrice,
        validity,
        validityMinutes,
        disclosedQuantity}: NormalOrderRequest = req.body;

    if(!userId || !orderSide || !quantity || !orderType || !validity){
        throw new BadRequestError("Missing Fields are Required");
    }

    // Limit-type order --> Price is Required

    if(orderType === OrderType.LIMIT_ORDER && !price){
        throw new BadRequestError("Price is Required for Limit order");
    }

    // for stop-loss order  --> Triggered Price is Required

    if(orderType === OrderType.SL || orderType === OrderType.SL_M){
        throw new BadRequestError("Triggered Price is Required for Stop-loss orders");
    }


    // check for validity 

    if(validity === OrderValidity.MINUTES && (!validityMinutes || validityMinutes <= 0)){
        throw new BadRequestError("Valid Minutes are Required to place order");
    }

    // check for users avlbl funds

    let userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['user_id', 'available_funds'])
        .executeTakeFirst();

    if(!userFunds){
        throw new NotFoundError("User Funds not found");
    }

    // get estimate value

    const estimatePrice:number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue:number = estimatePrice * quantity;

    // normal orders,  100% margin is required
    let requiredFunds: number = estimatedValue;

    // checking if user has sufficient funds

    if (userFunds.available_funds < requiredFunds) { 
        // Log the failed attempt 
        await db.transaction().execute(async (trx) => {
            await trx
            .insertInto('order_attempt_failures')
            .values({
            user_id: userId, 
            order_category: OrderCategory.NORMAL, 
            symbol: symbol, 
            order_side: orderSide, 
            quantity: quantity, 
            price: price || estimatePrice, 
            product_type: 'delivery', 
            order_type: orderType, 
            failure_reason: 'Insufficient funds', 
            required_funds: requiredFunds, 
            available_funds: userFunds.available_funds || 0, 
            attempted_at: new Date()
            } as OrderAttemptFailure)
            .execute();
                
            throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds.available_funds}`);

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
        symbol: symbol,
        order_side: orderSide,
        quantity: quantity,
        price: price || null,
        status: OrderStatus.QUEUED,
        placed_at: new Date()
    })
    .returningAll()
    .executeTakeFirst();

    // creating entry in order details table
    const normalOrder = await trx
    .insertInto('normal_orders')
    .values({
        order_id: order!.id,
        order_type: orderType,
        trigger_price: triggerPrice || null,
        validity: validity,
        validity_minutes: validity === OrderValidity.MINUTES ? validityMinutes : null,
        disclosed_quantity: disclosedQuantity || null
    })
    .returningAll()
    .executeTakeFirst();

    // deducting user funds

    await trx
    .updateTable('user_funds')
    .set({
        available_funds: eb => eb('available_funds', '-', requiredFunds),
        used_funds: eb => eb('used_funds', '+', requiredFunds),
        updated_at: new Date()
    })
    .where('user_id', '=', userId)
    .execute();

    return {
        order,
        normalOrder
    };
});

logger.info(`Normal order successfully created for user ${userId}`);

res.status(CREATED).json({
    message: "Normal Order Created Successfully",
    data: result
});
};

// Create Iceberg Order

const createIcebergOrder = async (req:Request, res: Response): Promise<void> =>{
    const userId: number = parseInt(req.params.user_id);

    if(isNaN(userId)){
        throw new BadRequestError("Invalid User ID");
    }
    const {symbol,
        orderSide,
        quantity,
        price,
        orderType,
        triggerPrice,
        validity,
        validityMinutes,
        disclosedQuantity,
        numOfLegs,
        productType}: IcebergOrderRequest = req.body;
    if(!symbol || !orderSide || !quantity || !orderType || !validity){
        throw new BadRequestError("Missing Fields are Required");
    }
    // Limit-type order --> Price is Required
    if (productType !== ProductType.INTRADAY && productType !== ProductType.DELIVERY) {
        throw new BadRequestError('Invalid product type');
    }

    if(orderType === OrderType.LIMIT_ORDER && !price){
        throw new BadRequestError("Price is Required for Limit order");
    }
    // for stop-loss order  --> Triggered Price is Required
    if((orderType === OrderType.SL || orderType === OrderType.SL_M) && !triggerPrice){
        throw new BadRequestError("Triggered Price is Required for Stop-loss orders");
    }

    // check for validity
    if(validity === OrderValidity.MINUTES && (!validityMinutes || validityMinutes <= 0)){
        throw new BadRequestError("Valid Minutes are Required to place order");
    }
    // check for the number of legs

    if(numOfLegs <= 0){
        throw new BadRequestError("Number of legs should be greater than 0");
    }

    // disclosed Qty check 
    if(disclosedQuantity <= 0 || disclosedQuantity > quantity){
        throw new BadRequestError("Disclosed quantity should be greater than 0");
    }

    // check for avlbl funds 
    let userFunds = await db
    .selectFrom('user_funds')
    .where('user_id', '=', userId)
    .select(['user_id', 'available_funds'])
    .executeTakeFirst();

    if(!userFunds){
        throw new NotFoundError("User Funds not found");
    }
    // get estimate value
    const estimatePrice:number = price || getEstimatedMarketPrice(symbol);
    const estimatedValue:number = estimatePrice * quantity;

    // calculate funds
    let requiredFunds: number ;

    if(productType === ProductType.INTRADAY){
        requiredFunds = estimatedValue * 0.2; // 20% margin for intraday
    }
    else{
        requiredFunds = estimatedValue // for delivery 100% margin utilization
    }

    // checking if user has sufficient funds
    if(!userFunds || userFunds.available_funds < requiredFunds){
        // log the failed attempt

        await db.transaction().execute(async (trx) => {
            await trx
            .insertInto('order_attempt_failures')
            .values({
            user_id: userId, 
            order_category: OrderCategory.ICEBERG, 
            symbol: symbol, 
            order_side: orderSide, 
            quantity: quantity, 
            price: price || estimatePrice, 
            product_type: productType, 
            order_type: orderType, 
            failure_reason: 'Insufficient funds', 
            required_funds: requiredFunds, 
            available_funds: userFunds.available_funds || 0, 
            attempted_at: new Date()
            } as OrderAttemptFailure)
            .execute();
                
            throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds.available_funds}`);
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
                symbol: symbol,
                order_side: orderSide,
                quantity: quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date()
            })
            .returningAll()
            .executeTakeFirst();

        // Create the iceberg order details
        const icebergOrder = await trx
            .insertInto('iceberg_orders')
            .values({
                order_id: order!.id,
                num_of_legs: numOfLegs,
                order_type: orderType,
                product_type: productType,
                trigger_price: triggerPrice || null,
                validity: validity,
                validity_minutes: validity === OrderValidity.MINUTES ? validityMinutes : null,
                disclosed_quantity: disclosedQuantity
            })
            .returningAll()
            .executeTakeFirst();

        // Create legs
        const legQuantity: number = Math.floor(quantity / numOfLegs);
        const legs = [];

        for (let i = 0; i < numOfLegs; i++) {
            // Adjust last leg quantity to account for rounding
            const actualLegQuantity: number = i === numOfLegs - 1 
                ? quantity - (legQuantity * (numOfLegs - 1)) 
                : legQuantity;

            const leg = await trx
                .insertInto('iceberg_legs')
                .values({
                    iceberg_order_id: order!.id,
                    leg_number: i + 1,
                    quantity: actualLegQuantity,
                    status: i === 0 ? OrderStatus.QUEUED : OrderStatus.PENDING
                })
                .returningAll()
                .executeTakeFirst();

            legs.push(leg);
        }
    // Deduct the required funds from the user's available funds
    await trx
    .updateTable('user_funds')
    .set({
        available_funds: eb => eb('available_funds', '-', requiredFunds),
        used_funds: eb => eb('used_funds', '+', requiredFunds),
        updated_at: new Date()
    })
    .where('user_id', '=', userId)
    .execute();

return {
    order,
    icebergOrder,
    legs,
    fundDetails: {
        requiredFunds,
        remainingFunds: userFunds.available_funds - requiredFunds,
        productType
    }
};
});

logger.info(`Iceberg order successfully created for user ${userId}`);

res.status(CREATED).json({
    Message:"Iceberg Order Created Successfully",
    data:result
})
}


// creating cover order

const createCoverOrder = async(req: Request , res: Response): Promise<void> =>{

    const userId: number = parseInt(req.params.user_id);

    if(isNaN(userId)){
        throw new BadRequestError("Invalid User ID");
    }
    const {
        symbol,
        orderSide,
        quantity,
        price,
        orderType,
        stopLossPrice
    }: CoverOrderRequest = req.body;

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

    let userFunds = await db
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

    // Cover orders are always intraday, typically require less margin (e.g., 20%)
    const requiredFunds: number = estimatedValue * 0.2;

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
        // Log the failed attempt
        await db.transaction().execute(async (tx) => {
            await tx
                .insertInto('order_attempt_failures')
                .values({
                    user_id: userId,
                    order_category: OrderCategory.COVER_ORDER,
                    symbol: symbol,
                    order_side: orderSide,
                    quantity: quantity,
                    price: price || estimatePrice,
                    product_type: ProductType.INTRADAY,
                    order_type: orderType,
                    failure_reason: 'Insufficient funds',
                    required_funds: requiredFunds,
                    available_funds: userFunds?.available_funds || 0,
                    attempted_at: new Date()
                } as OrderAttemptFailure)
                .execute();
            
            throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds?.available_funds}`);
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
                symbol: symbol,
                order_side: orderSide,
                quantity: quantity,
                price: price || null,
                status: OrderStatus.QUEUED,
                placed_at: new Date()
            })
            .returningAll()
            .executeTakeFirst();

        // Create the cover order details
        const coverOrder = await trx
            .insertInto('cover_orders')
            .values({
                order_id: order!.id,
                stop_loss_price: stopLossPrice,
                order_type: orderType
            })
            .returningAll()
            .executeTakeFirst();

        // Create cover order details tracking both main and stop-loss orders
        const coverOrderDetails = await trx
            .insertInto('cover_order_details')
            .values({
                cover_order_id: order!.id,
                main_order_status: OrderStatus.QUEUED,
                stop_loss_order_status: OrderStatus.QUEUED
            })
            .returningAll()
            .executeTakeFirst();

        // Deduct the required funds from the user's available funds
        await trx
            .updateTable('user_funds')
            .set({
                available_funds: eb => eb('available_funds', '-', requiredFunds),
                used_funds: eb => eb('used_funds', '+', requiredFunds),
                updated_at: new Date()
            })
            .where('user_id', '=', userId)
            .execute();

        return {
            order,
            coverOrder,
            coverOrderDetails
        };
    });

    logger.info(`Cover order successfully created for user ${userId}`);

    res.status(CREATED).json({
        Message: "Cover Order Created Successfully",
        data:result
    });
};

// Helper function to get estimated market price
function getEstimatedMarketPrice(symbol: string): number {
    // In a real implementation, you would call a market data API
    // For this example, we'll use a mock implementation
    
    // Sample price mapping
    const prices: Record<string, number> = {
        'RELIANCE': 2500,
        'INFY': 1500,
        'TCS': 3200,
        'HDFCBANK': 1650,
        'TATASTEEL': 120
    };
    
    // Return price or default
    return prices[symbol] || 1000; // Default price if symbol not found
}

// Get all orders of users
const getAllOrders = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id);

    if (isNaN(userId)) {
        throw new BadRequestError("Invalid User ID");
    }

    const status = req.query.status as OrderStatus | undefined;
    const category = req.query.category as OrderCategory | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    // Pagination handling
    const pageSize: number = limit;
    const currentPage: number = page;
    const offset: number = (currentPage - 1) * pageSize;

    // Build query
    let query = db
        .selectFrom('orders')
        .where('user_id', '=', userId);

    // Add filters
    if (status) {
        query = query.where('status', '=', status as any);
    }

    if (category) {
        query = query.where('order_category', '=', category);
    }

    // Adding pagination
    let countQuery = db
        .selectFrom('orders')
        .where('user_id', '=', userId);

    // Apply the same filters as the main query
    if (status) {
        countQuery = countQuery.where('status', '=', status as any);
    }

    if (category) {
        countQuery = countQuery.where('order_category', '=', category);
    }

    // Select count
    const totalResult = await countQuery
        .select(db.fn.count('id').as('total'))
        .executeTakeFirst();

    const total: number = totalResult && 'total' in totalResult
        ? Number(totalResult.total)
        : 0;

    // Get orders with pagination
    const orders = await query
        .orderBy('placed_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .selectAll()
        .execute();

    res.status(OK).json({
        success: true,
        data: {
            orders,
            pagination: {
                total,
                page: currentPage,
                pageSize,
                pages: Math.ceil(total / pageSize)
            }
        }
    });
};

// get-order-details by ID

const getOrderById = async (req:Request, res:Response): Promise<void> => {
    const orderId: number = parseInt(req.params.order_id);

    if(isNaN(orderId)){
        throw new BadRequestError("Invalid Order ID");
    }

    // getting order

    const order = await db
    .selectFrom('orders')
    .where('id', '=', orderId)
    .selectAll()
    .executeTakeFirst();

    if(!order){
        throw new NotFoundError("Order not found");
    }
    let orderDetails = null;
    let additionalDetails = null;

    // using switch-case

    switch(order.order_category){
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
          additionalDetails: additionalDetails || undefined
        }
        });
};

// get cancel-orders
const cancelOrder = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.order_id);

    if (isNaN(orderId)) {
        throw new BadRequestError('Invalid order ID');
    }

    // Execute the transaction
    const result = await db.transaction().execute(async (trx) => {
        // Get the order
        const order = await trx
            .selectFrom('orders')
            .where('id', '=', orderId)
            .selectAll()
            .executeTakeFirst();

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
                cancelled_at: new Date()
            })
            .where('id', '=', orderId)
            .returningAll()
            .executeTakeFirst();

        // Handle special cases for different order types
        switch (order.order_category) {
            case OrderCategory.ICEBERG:
                // Update all queued legs
                await trx
                    .updateTable('iceberg_legs')
                    .set({
                        status: OrderStatus.CANCELLED,
                        cancelled_at: new Date()
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
                        stop_loss_order_status: OrderStatus.CANCELLED
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
                changed_by: 'user'
            })
            .execute();

        return updatedOrder;
    });
    res.status(OK).json({
        data: result,
        message: 'Order cancelled successfully'
    });
};



// get-order-history

const getOrderHistory = async(req:Request, res: Response):Promise<void> =>{
    const orderId : number = parseInt(req.params.order_id);

    if (isNaN(orderId)) {
        throw new BadRequestError('Invalid order ID');
      }
    
      // Check if order exists
      const order = await db
        .selectFrom('orders')
        .where('id', '=', orderId)
        .selectAll()
        .executeTakeFirst();
    
      if (!order) {
        throw new NotFoundError('Order not found');
      }
    
      // Get order history
      const history = await db
        .selectFrom('order_history')
        .where('order_id', '=', orderId)
        .orderBy('changed_at', 'asc')
        .selectAll()
        .execute();
    
      res.status(OK).json({
        success: true,
        data: {
          order,
          history
        }
    });
};
    

// get-order-summary

const getOrderSummary = async(req:Request, res: Response): Promise<void> =>{
    const userId: number = parseInt(req.params.user_id);

  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }

  // count for different order-categories

  const summary = await db
    .selectFrom('orders')
    .where('user_id', '=', userId)
    .select([
      db.fn.count('id').as('total'),
      'order_category',
      'status'
    ])
    .groupBy(['order_category', 'status'])
    .execute();

    const result = {
        total: 0,
        byCategory: {
          instant: { total: 0, queued: 0, executed: 0, rejected: 0, cancelled: 0 },
          normal: { total: 0, queued: 0, executed: 0, rejected: 0, cancelled: 0 },
          iceberg: { total: 0, queued: 0, executed: 0, rejected: 0, cancelled: 0 },
          cover_order: { total: 0, queued: 0, executed: 0, rejected: 0, cancelled: 0 }
        },
        byStatus: {
          queued: 0,
          executed: 0,
          rejected: 0,
          cancelled: 0
        }
      };
      for (const item of summary) {
        const count = parseInt(item.total as string);
        const category = item.order_category as OrderCategory;
        const status = item.status as OrderStatus;
    
        // Update total
        result.total += count;
    
        // // Update by category
        // result.byCategory[category].total += count;
        // result.byCategory[category][status as keyof typeof result.byCategory[OrderCategory.INSTANT]] += count;
    
        // // Update by status
        // result.byStatus[status as keyof typeof result.byStatus] += count;

        // Update by category with any type assertion
    if (category in result.byCategory) {
        (result.byCategory as any)[category].total += count;
    
        if (status in (result.byCategory as any)[category]) {
      (result.byCategory as any)[category][status] += count;
        }
    }

    // Update by status
    if (status in result.byStatus) {
        (result.byStatus as any)[status] += count;
    }
    }
    
      res.status(OK).json({
        success: true,
        data: result
      });
};

// get-recent-orders

const getRecentOrders = async (req: Request, res: Response): Promise<void> => {
    const userId: number = parseInt(req.params.user_id);
    
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }
    
    const limit: number = req.query.limit ? parseInt(req.query.limit as string) : 5;
  
    const recentOrders = await db
      .selectFrom('orders')
      .where('user_id', '=', userId)
      .orderBy('placed_at', 'desc')
      .limit(limit)
      .selectAll()
      .execute();
  
    res.status(OK).json({
      success: true,
      data: recentOrders
    });
};

// failed-orders-attempt

const getFailedOrderAttempts = async(req: Request, res: Response):Promise<void> =>{
    const userId: number = parseInt(req.params.user_id);
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  
  const page: number = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit: number = req.query.limit ? parseInt(req.query.limit as string) : 20;
  
  // Pagination
  const pageSize: number = limit;
  const currentPage: number = page;
  const offset: number = (currentPage - 1) * pageSize;

  let countQuery = db
    .selectFrom('order_attempt_failures')
    .where('user_id', '=', userId);
  
  // Select count
  const totalResult = await countQuery
    .select(db.fn.count('id').as('total'))
    .executeTakeFirst();
  
  // Parse count result
  const total: number = totalResult && 'total' in totalResult ? Number(totalResult.total): 0;
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
        pages: Math.ceil(total / pageSize)
      }
    }
  });
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
    getOrderSummary,
    getRecentOrders,
    getFailedOrderAttempts
};