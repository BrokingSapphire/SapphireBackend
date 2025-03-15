// orderManagement.controller.ts

import { Request, Response } from 'express';
import {db} from '@app/database';
import { wsManager } from '../../lib/websocket/wsManager';
import createOrderWebSocketHandler, { OrderWebSocketEventType } from './order.ws';
import logger from '@app/logger';
import {
  CreateInstantOrderRequest,
  CreateNormalOrderRequest,
  CreateIcebergOrderRequest,
  CreateCoverOrderRequest,
  GetOrdersQueryParams,
  GetFailedAttemptsQueryParams,
  UserFunds,
  Order,
  TransactionContext,
  OrderStatus,
  OrderHistory,
  OrderAttemptFailure,
  PaginationInfo,
  OrderCategory
} from './order.types';
import { BadRequestError, NotFoundError } from '@app/apiError';

// Create a WebSocket handler
const wsHandler = createOrderWebSocketHandler(wsManager as any);

/**
 * Get estimated market price for a symbol
 */
const getEstimatedMarketPrice = async (symbol: string): Promise<number> => {
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
};

/**
 * Create instant order
 */
export const createInstantOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received create instant order request');

    const userId = parseInt(req.params.userId);
    const {
      symbol,
      orderSide,
      quantity,
      price,
      productType,
      orderType
    } = req.body as CreateInstantOrderRequest;

    // Validate required fields
    if (!symbol || !orderSide || !quantity || !productType || !orderType) {
      throw new BadRequestError('Missing required fields for instant order');
    }

    // Validate enum values
    const validOrderSides = ['buy', 'sell'];
    const validProductTypes = ['intraday', 'delivery', 'mtf', 'futures', 'options'];
    const validOrderTypes = ['market_order', 'limit_order'];

    if (!validOrderSides.includes(orderSide)) {
      throw new BadRequestError('Invalid order side');
    }

    if (!validProductTypes.includes(productType)) {
      throw new BadRequestError('Invalid product type');
    }

    if (!validOrderTypes.includes(orderType)) {
      throw new BadRequestError('Invalid order type');
    }

    // For limit orders, price is required
    if (orderType === 'limit_order' && !price) {
      throw new BadRequestError('Price is required for limit orders');
    }

    // Check if user has sufficient funds
    const userFunds = await db
      .selectFrom('user_funds')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst() as UserFunds | undefined;

    // Get estimated order value
    const estimatedPrice = price || await getEstimatedMarketPrice(symbol);
    const estimatedOrderValue = quantity * estimatedPrice;

    // For margin products, apply appropriate margin requirement
    let requiredFunds = estimatedOrderValue;
    if (productType === 'intraday') {
      // Intraday typically requires less margin (e.g., 20%)
      requiredFunds = estimatedOrderValue * 0.2;
    } else if (productType === 'mtf') {
      // MTF might require a different percentage
      requiredFunds = estimatedOrderValue * 0.4;
    }

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
      // Log the failed attempt
      await db
        .insertInto('order_attempt_failures')
        .values({
          user_id: userId,
          order_category: 'normal',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || estimatedPrice,
          product_type: 'delivery', // Default for normal orders
          order_type: orderType,
          failure_reason: 'Insufficient funds',
          required_funds: requiredFunds,
          available_funds: userFunds?.available_funds || 0,
          attempted_at: new Date()
        })
        .execute();
  
      throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds?.available_funds || 0}`);
    }
  
    // Create order in transaction
    const result = await db.transaction().execute(async (trx: TransactionContext) => {
      // First create the main order record
      const order = await trx
        .insertInto('orders')
        .values({
          user_id: userId,
          order_category: 'instant',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || null,
          status: 'queued',
          placed_at: new Date()
        })
        .returningAll()
        .executeTakeFirst() as Order;
  
      // Then create the instant order details
      const instantOrder = await trx
        .insertInto('instant_orders')
        .values({
          order_id: order.id,
          product_type: productType,
          order_type: orderType
        })
        .returningAll()
        .executeTakeFirst();
  
      // Deduct the required funds from the user's available funds
      await trx
        .updateTable('user_funds')
        .set({
          available_funds: (eb: any) => eb('available_funds', '-', requiredFunds),
          used_funds: (eb: any) => eb('used_funds', '+', requiredFunds),
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
  
    // Send websocket notification using the handler
    wsHandler.notifyOrderCreated(
      userId, 
      OrderWebSocketEventType.INSTANT_ORDER_CREATED, 
      result
    );
  
    logger.info('Instant order created successfully', { orderId: result.order.id });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Instant order created successfully'
    });
  } catch (error) {
    logger.error('Error creating instant order:', error);
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create instant order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Create normal order
 */
export const createNormalOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received create normal order request');
    
    const userId = parseInt(req.params.userId);
    const {
      symbol,
      orderSide,
      quantity,
      price,
      orderType,
      triggerPrice,
      validity,
      validityMinutes,
      disclosedQuantity
    } = req.body as CreateNormalOrderRequest;

    // Validate required fields
    if (!symbol || !orderSide || !quantity || !orderType || !validity) {
      throw new BadRequestError('Missing required fields for normal order');
    }

    // Validate enum values
    const validOrderSides = ['buy', 'sell'];
    const validOrderTypes = ['market_order', 'limit_order', 'sl', 'sl_m'];
    const validValidities = ['day', 'immediate', 'minutes'];

    if (!validOrderSides.includes(orderSide)) {
      throw new BadRequestError('Invalid order side');
    }

    if (!validOrderTypes.includes(orderType)) {
      throw new BadRequestError('Invalid order type');
    }

    if (!validValidities.includes(validity)) {
      throw new BadRequestError('Invalid validity');
    }

    // For limit orders, price is required
    if (orderType === 'limit_order' && !price) {
      throw new BadRequestError('Price is required for limit orders');
    }

    // For stop loss orders, trigger price is required
    if ((orderType === 'sl' || orderType === 'sl_m') && !triggerPrice) {
      throw new BadRequestError('Trigger price is required for stop loss orders');
    }

    // For minutes validity, validityMinutes is required
    if (validity === 'minutes' && (!validityMinutes || validityMinutes <= 0)) {
      throw new BadRequestError('Valid minutes value is required for minutes validity');
    }

    // Check if user has sufficient funds
    const userFunds = await db
      .selectFrom('user_funds')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst() as UserFunds | undefined;

    // Get estimated order value
    const estimatedPrice = price || await getEstimatedMarketPrice(symbol);
    const estimatedOrderValue = quantity * estimatedPrice;

    // For normal orders, use 100% margin requirement (could vary in real implementation)
    const requiredFunds = estimatedOrderValue;

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
      // Log the failed attempt
      await db
        .insertInto('order_attempt_failures')
        .values({
          user_id: userId,
          order_category: 'normal',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || estimatedPrice,
          product_type: 'delivery',
          order_type: orderType,
          failure_reason: 'Insufficient funds',
          required_funds: requiredFunds,
          available_funds: userFunds?.available_funds || 0,
          attempted_at: new Date()
        })
        .execute();
  
      throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds?.available_funds || 0}`);
    }

    // Create order in transaction
    const result = await db.transaction().execute(async (trx: TransactionContext) => {
      // First create the main order record
      const order = await trx
        .insertInto('orders')
        .values({
          user_id: userId,
          order_category: 'normal',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || null,
          status: 'queued',
          placed_at: new Date()
        })
        .returningAll()
        .executeTakeFirst() as Order;

      // Then create the normal order details
      const normalOrder = await trx
        .insertInto('normal_orders')
        .values({
          order_id: order.id,
          order_type: orderType,
          trigger_price: triggerPrice || null,
          validity: validity,
          validity_minutes: validity === 'minutes' ? validityMinutes : null,
          disclosed_quantity: disclosedQuantity || null
        })
        .returningAll()
        .executeTakeFirst();

      // Deduct the required funds from the user's available funds
      await trx
        .updateTable('user_funds')
        .set({
          available_funds: (eb: any) => eb('available_funds', '-', requiredFunds),
          used_funds: (eb: any) => eb('used_funds', '+', requiredFunds),
          updated_at: new Date()
        })
        .where('user_id', '=', userId)
        .execute(); 

      return {
        order,
        normalOrder
      };
    });

    // Send websocket notification using the handler
    wsHandler.notifyOrderCreated(
      userId,
      OrderWebSocketEventType.NORMAL_ORDER_CREATED,
      result
    );

    logger.info('Normal order created successfully', { orderId: result.order.id });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Normal order created successfully'
    });
  } catch (error) {
    logger.error('Error creating normal order:', error);
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create normal order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Create iceberg order (supports both delivery and intraday)
 */
export const createIcebergOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received create iceberg order request');
    
    const userId = parseInt(req.params.userId);
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
      productType
    } = req.body as CreateIcebergOrderRequest;

    // Validate required fields
    if (!symbol || !orderSide || !quantity || !orderType || !validity || !disclosedQuantity || !numOfLegs || !productType) {
      throw new BadRequestError('Missing required fields for iceberg order');
    }

    // Validate enum values
    const validOrderSides = ['buy', 'sell'];
    const validOrderTypes = ['market_order', 'limit_order', 'sl', 'sl_m'];
    const validValidities = ['day', 'immediate', 'minutes'];
    const validProductTypes = ['intraday', 'delivery']; // Valid product types

    if (!validOrderSides.includes(orderSide)) {
      throw new BadRequestError('Invalid order side');
    }

    if (!validOrderTypes.includes(orderType)) {
      throw new BadRequestError('Invalid order type');
    }

    if (!validValidities.includes(validity)) {
      throw new BadRequestError('Invalid validity');
    }

    if (!validProductTypes.includes(productType)) {
      throw new BadRequestError('Invalid product type');
    }

    // For limit orders, price is required
    if (orderType === 'limit_order' && !price) {
      throw new BadRequestError('Price is required for limit orders');
    }

    // For stop loss orders, trigger price is required
    if ((orderType === 'sl' || orderType === 'sl_m') && !triggerPrice) {
      throw new BadRequestError('Trigger price is required for stop loss orders');
    }

    // Validate numOfLegs
    if (numOfLegs <= 0) {
      throw new BadRequestError('Number of legs must be greater than 0');
    }

    // Validate disclosed quantity
    if (disclosedQuantity <= 0 || disclosedQuantity > quantity) {
      throw new BadRequestError('Disclosed quantity must be greater than 0 and less than or equal to total quantity');
    }

    // Check if user has sufficient funds
    const userFunds = await db
      .selectFrom('user_funds')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst() as UserFunds | undefined;

    // Get estimated order value
    const estimatedPrice = price || await getEstimatedMarketPrice(symbol);
    const estimatedOrderValue = quantity * estimatedPrice;

    // Calculate required funds based on product type
    let requiredFunds;
    if (productType === 'intraday') {
      // Intraday typically requires less margin (e.g., 20%)
      requiredFunds = estimatedOrderValue * 0.2;
    } else {
      // Delivery orders use 100% margin requirement
      requiredFunds = estimatedOrderValue;
    }

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
      // Log the failed attempt
      await db
        .insertInto('order_attempt_failures')
        .values({
          user_id: userId,
          order_category: 'iceberg',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || estimatedPrice,
          product_type: productType,
          order_type: orderType,
          failure_reason: 'Insufficient funds',
          required_funds: requiredFunds,
          available_funds: userFunds?.available_funds || 0,
          attempted_at: new Date()
        })
        .execute();
    
      throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds?.available_funds || 0}`);
    }

    // Create order in transaction
    const result = await db.transaction().execute(async (trx: TransactionContext) => {
      // First create the main order record
      const order = await trx
        .insertInto('orders')
        .values({
          user_id: userId,
          order_category: 'iceberg',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || null,
          status: 'queued',
          placed_at: new Date()
        })
        .returningAll()
        .executeTakeFirst() as Order;

      // Create the iceberg order details
      const icebergOrder = await trx
        .insertInto('iceberg_orders')
        .values({
          order_id: order.id,
          num_of_legs: numOfLegs,
          order_type: orderType,
          product_type: productType, // Store the product type
          trigger_price: triggerPrice || null,
          validity: validity,
          validity_minutes: validity === 'minutes' ? validityMinutes : null,
          disclosed_quantity: disclosedQuantity
        })
        .returningAll()
        .executeTakeFirst();

      // Create legs
      const legQuantity = Math.floor(quantity / numOfLegs);
      const legs = [];

      for (let i = 0; i < numOfLegs; i++) {
        // Adjust last leg quantity to account for rounding
        const actualLegQuantity = i === numOfLegs - 1 
          ? quantity - (legQuantity * (numOfLegs - 1)) 
          : legQuantity;

        const leg = await trx
          .insertInto('iceberg_legs')
          .values({
            iceberg_order_id: order.id,
            leg_number: i + 1,
            quantity: actualLegQuantity,
            status: i === 0 ? 'queued' : 'pending' // First leg starts as queued, others as pending
          })
          .returningAll()
          .executeTakeFirst();

        legs.push(leg);
      }

      // Deduct the required funds from the user's available funds
      await trx
        .updateTable('user_funds')
        .set({
          available_funds: (eb: any) => eb('available_funds', '-', requiredFunds),
          used_funds: (eb: any) => eb('used_funds', '+', requiredFunds),
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

    // Send websocket notification using the handler
    wsHandler.notifyOrderCreated(
      userId,
      OrderWebSocketEventType.ICEBERG_ORDER_CREATED,
      result
    );

    logger.info('Iceberg order created successfully', { orderId: result.order.id });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Iceberg order created successfully'
    });
  } catch (error) {
    logger.error('Error creating iceberg order:', error);
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create iceberg order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Create cover order (always for intraday)
 */
export const createCoverOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received create cover order request');
    
    const userId = parseInt(req.params.userId);
    const {
      symbol,
      orderSide,
      quantity,
      price,
      orderType,
      stopLossPrice
    } = req.body as CreateCoverOrderRequest;

    // Validate required fields
    if (!symbol || !orderSide || !quantity || !orderType || !stopLossPrice) {
      throw new BadRequestError('Missing required fields for cover order');
    }

    // Validate enum values
    const validOrderSides = ['buy', 'sell'];
    const validOrderTypes = ['market_order', 'limit_order'];

    if (!validOrderSides.includes(orderSide)) {
      throw new BadRequestError('Invalid order side');
    }

    if (!validOrderTypes.includes(orderType)) {
      throw new BadRequestError('Invalid order type');
    }

    // For limit orders, price is required
    if (orderType === 'limit_order' && !price) {
      throw new BadRequestError('Price is required for limit orders');
    }

    // Validate stop loss price
    if (orderSide === 'buy' && stopLossPrice >= (price || 0)) {
      throw new BadRequestError('For buy orders, stop loss price must be less than the price');
    }

    if (orderSide === 'sell' && stopLossPrice <= (price || Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestError('For sell orders, stop loss price must be greater than the price');
    }

    // Check if user has sufficient funds
    const userFunds = await db
      .selectFrom('user_funds')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst() as UserFunds | undefined;

    // Get estimated order value
    const estimatedPrice = price || await getEstimatedMarketPrice(symbol);
    const estimatedOrderValue = quantity * estimatedPrice;

    // Cover orders are always intraday, typically require less margin (e.g., 20%)
    const requiredFunds = estimatedOrderValue * 0.2;

    // Check if sufficient funds
    if (!userFunds || userFunds.available_funds < requiredFunds) {
      // Log the failed attempt
      await db
        .insertInto('order_attempt_failures')
        .values({
          user_id: userId,
          order_category: 'cover_order',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || estimatedPrice,
          product_type: 'intraday',
          order_type: orderType,
          failure_reason: 'Insufficient funds',
          required_funds: requiredFunds,
          available_funds: userFunds?.available_funds || 0,
          attempted_at: new Date()
        })
        .execute();
    
      throw new BadRequestError(`Insufficient funds to place this order. Required: ${requiredFunds}, Available: ${userFunds?.available_funds || 0}`);
    }

    // Create order in transaction
    const result = await db.transaction().execute(async (trx: TransactionContext) => {
      // First create the main order record
      const order = await trx
        .insertInto('orders')
        .values({
          user_id: userId,
          order_category: 'cover_order',
          symbol: symbol,
          order_side: orderSide,
          quantity: quantity,
          price: price || null,
          status: 'queued',
          placed_at: new Date()
        })
        .returningAll()
        .executeTakeFirst() as Order;

      // Create the cover order details
      const coverOrder = await trx
        .insertInto('cover_orders')
        .values({
          order_id: order.id,
          stop_loss_price: stopLossPrice,
          order_type: orderType
        })
        .returningAll()
        .executeTakeFirst();

      // Create cover order details tracking both main and stop-loss orders
      const coverOrderDetails = await trx
        .insertInto('cover_order_details')
        .values({
          cover_order_id: order.id,
          main_order_status: 'queued',
          stop_loss_order_status: 'queued'
        })
        .returningAll()
        .executeTakeFirst();

      // Deduct the required funds from the user's available funds
      await trx
        .updateTable('user_funds')
        .set({
          available_funds: (eb: any) => eb('available_funds', '-', requiredFunds),
          used_funds: (eb: any) => eb('used_funds', '+', requiredFunds),
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

    // Send websocket notification using the handler
    wsHandler.notifyOrderCreated(
      userId,
      OrderWebSocketEventType.COVER_ORDER_CREATED,
      result
    );

    logger.info('Cover order created successfully', { orderId: result.order.id });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Cover order created successfully'
    });
  } catch (error) {
    logger.error('Error creating cover order:', error);
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create cover order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Get all orders for a user
 */
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching user orders');
    
    const userId = parseInt(req.params.userId);
    const { status, category, page, limit } = req.query as GetOrdersQueryParams;
    
    // Pagination
    const pageSize = limit ? parseInt(limit) : 20;
    const currentPage = page ? parseInt(page) : 1;
    const offset = (currentPage - 1) * pageSize;

    // Build query
    let query = db
      .selectFrom('orders')
      .where('user_id', '=', userId);

    // Add filters
    if (status) {
      query = query.where('status', '=', status as any);
    }

    if (category) {
      query = query.where('order_category', '=', category as any);
    }

    // Get total count for pagination
    const countQuery = db
    .selectFrom('orders')
    .where('user_id', '=', userId);
  
    // Apply the same filters to the count query
    if (status) {
    countQuery.where('status', '=', status as any);
    }

    if (category) {
    countQuery.where('order_category', '=', category as any);
    }
    const totalResult = await countQuery.executeTakeFirst() as { total: string } | undefined;
    const total = totalResult?.total ? parseInt(totalResult.total) : 0;

    // Get orders with pagination
    const orders = await query
      .orderBy('placed_at', 'desc')
      .limit(pageSize)
      .offset(offset)
      .selectAll()
      .execute() as Order[];

    logger.info(`Found ${orders.length} orders for user ${userId}`);
    res.status(200).json({
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
  } catch (error) {
    logger.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get order details by ID
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching order details');
    
    const orderId = parseInt(req.params.orderId);

    // Get the base order
    const order = await db
      .selectFrom('orders')
      .where('id', '=', orderId)
      .selectAll()
      .executeTakeFirst() as Order | undefined;

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Get specific order details based on category
    let orderDetails = null;
    let additionalDetails = null;

    switch (order.order_category) {
      case 'instant':
        orderDetails = await db
          .selectFrom('instant_orders')
          .where('order_id', '=', orderId)
          .selectAll()
          .executeTakeFirst();
        break;
      case 'normal':
        orderDetails = await db
          .selectFrom('normal_orders')
          .where('order_id', '=', orderId)
          .selectAll()
          .executeTakeFirst();
        break;
      case 'iceberg':
        orderDetails = await db
          .selectFrom('iceberg_orders')
          .where('order_id', '=', orderId)
          .selectAll()
          .executeTakeFirst();
        
        // Get iceberg legs
        additionalDetails = await db
          .selectFrom('iceberg_legs')
          .where('iceberg_order_id', '=', orderId)
          .selectAll()
          .execute();
        break;
      case 'cover_order':
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

    logger.info(`Retrieved order details for order ${orderId}`);
    res.status(200).json({
      success: true,
      data: {
        order,
        orderDetails,
        additionalDetails: additionalDetails || undefined
      }
    });
  } catch (error) {
    logger.error('Error fetching order details:', error);
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Cancel order
 */
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Cancelling order');
    
    const orderId = parseInt(req.params.orderId);

    const result = await db.transaction().execute(async (trx: TransactionContext) => {
      // Get the order
      const order = await trx
        .selectFrom('orders')
        .where('id', '=', orderId)
        .selectAll()
        .executeTakeFirst() as Order | undefined;

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check if the order can be cancelled
      if (order.status !== 'queued') {
        throw new BadRequestError(`Cannot cancel order with status "${order.status}"`);
      }

      // Update the order status
      const updatedOrder = await trx
        .updateTable('orders')
        .set({
          status: 'cancelled' as OrderStatus,
          cancelled_at: new Date()
        })
        .where('id', '=', orderId)
        .returningAll()
        .executeTakeFirst() as Order;

      // Handle special cases for different order types
      switch (order.order_category) {
        case 'iceberg':
          // Update all queued legs
          await trx
            .updateTable('iceberg_legs')
            .set({
              status: 'cancelled' as OrderStatus,
              cancelled_at: new Date()
            })
            .where('iceberg_order_id', '=', orderId)
            .where('status', '=', 'queued')
            .execute();
          break;
        case 'cover_order':
          // Update cover order details
          await trx
            .updateTable('cover_order_details')
            .set({
              main_order_status: 'cancelled' as OrderStatus,
              stop_loss_order_status: 'cancelled' as OrderStatus
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
          previous_status: 'queued' as OrderStatus,
          new_status: 'cancelled' as OrderStatus,
          changed_at: new Date(),
          remarks: 'Order cancelled by user',
          changed_by: 'user'
        })
        .execute();

      return updatedOrder;
    });

    // Send websocket notification using the handler
    wsHandler.notifyOrderCancelled(result.user_id, { order: result });

    logger.info(`Order ${orderId} cancelled successfully`);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Get order history
 */
export const getOrderHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching order history');
    
    const orderId = parseInt(req.params.orderId);

    // Check if order exists
    const order = await db
      .selectFrom('orders')
      .where('id', '=', orderId)
      .selectAll()
      .executeTakeFirst() as Order | undefined;

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Get order history
    const history = await db
      .selectFrom('order_history')
      .where('order_id', '=', orderId)
      .orderBy('changed_at', 'asc')
      .selectAll()
      .execute() as OrderHistory[];

    logger.info(`Retrieved history for order ${orderId}`);
    res.status(200).json({
      success: true,
      data: {
        order,
        history
      }
    });
  } catch (error) {
    logger.error('Error fetching order history:', error);
    
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Get summary of orders
 */
export const getOrderSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Generating order summary');
    
    const userId = parseInt(req.params.userId);

    // Get counts for different order categories and statuses
    const summary = await db
      .selectFrom('orders')
      .where('user_id', '=', userId)
      .select([
        db.fn.count('id').as('total'),
        'order_category',
        'status'
      ])
      .groupBy(['order_category', 'status'])
      .execute() as Array<{
        total: string;
        order_category: OrderCategory;
        status: OrderStatus;
      }>;

    // Restructure the data for easier consumption
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
      const count = parseInt(item.total);
      const category = item.order_category;
      const status = item.status;

      // Update total
      result.total += count;

      // Update by category
      result.byCategory[category].total += count;
      // TypeScript sees status as OrderStatus which includes 'pending', but we know the data doesn't include 'pending'
      // so we narrow it to the statuses we know will be in the data and exist in CategorySummary
      if (status === 'queued' || status === 'executed' || status === 'rejected' || status === 'cancelled') {
        result.byCategory[category][status] += count;
      }

      // Update by status
      if (status === 'queued' || status === 'executed' || status === 'rejected' || status === 'cancelled') {
        result.byStatus[status] += count;
      }
    }

    logger.info(`Generated order summary for user ${userId}`);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching order summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get recent orders
 */
export const getRecentOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching recent orders');
    
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    const recentOrders = await db
      .selectFrom('orders')
      .where('user_id', '=', userId)
      .orderBy('placed_at', 'desc')
      .limit(limit)
      .selectAll()
      .execute() as Order[];

    logger.info(`Retrieved ${recentOrders.length} recent orders for user ${userId}`);
    res.status(200).json({
      success: true,
      data: recentOrders
    });
  } catch (error) {
    logger.error('Error fetching recent orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get failed order attempts for a user
 */
export const getFailedOrderAttempts = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching failed order attempts');
    
    const userId = parseInt(req.params.userId);
    const { page, limit } = req.query as GetFailedAttemptsQueryParams;
    
    // Pagination
    const pageSize = limit ? parseInt(limit) : 20;
    const currentPage = page ? parseInt(page) : 1;
    const offset = (currentPage - 1) * pageSize;

    // Get total count for pagination
    const countQuery = db
      .selectFrom('order_attempt_failures')
      .where('user_id', '=', userId)
      .select(db.fn.count('id').as('total'));
    
    const totalResult = await countQuery.executeTakeFirst() as { total: string } | undefined;
    const total = totalResult?.total ? parseInt(totalResult.total) : 0;

    // Get failed attempts with pagination
    const failedAttempts = await db
      .selectFrom('order_attempt_failures')
      .where('user_id', '=', userId)
      .orderBy('attempted_at', 'desc')
      .limit(pageSize)
      .offset(offset)
      .selectAll()
      .execute() as OrderAttemptFailure[];

    logger.info(`Retrieved ${failedAttempts.length} failed order attempts for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        failedAttempts,
        pagination: {
          total,
          page: currentPage,
          pageSize,
          pages: Math.ceil(total / pageSize)
        } as PaginationInfo
      }
    });
  } catch (error) {
    logger.error('Error fetching failed order attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch failed order attempts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};