// order.routes.ts

import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    InstantOrderSchema,
    NormalOrderSchema,
    IcebergOrderSchema,
    CoverOrderSchema,
    OrderIdSchema,
    OrderQuerySchema,
    OrderLimitSchema,
} from './order.validator';
import { orderManagementController } from './orderManagement.controller';
import { jwtMiddleware } from '@app/utils/jwt';

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management endpoints
 */
const router = Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get all orders
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by order category (INSTANT, NORMAL, ICEBERG, COVER_ORDER)
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of results per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully
 */
router.get('/orders', [jwtMiddleware, validate(OrderQuerySchema)], orderManagementController.getAllOrders);

/**
 * @swagger
 * /orders/queued:
 *   get:
 *     tags: [Orders]
 *     summary: Get all queued orders
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by order category (INSTANT, NORMAL, ICEBERG, COVER_ORDER)
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of results per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of queued orders retrieved successfully
 */
router.get('/orders/queued', [jwtMiddleware, validate(OrderQuerySchema)], orderManagementController.getQueuedOrders);

/**
 * @swagger
 * /orders/executed:
 *   get:
 *     tags: [Orders]
 *     summary: Get all executed orders
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by order category (INSTANT, NORMAL, ICEBERG, COVER_ORDER)
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of results per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of executed orders retrieved successfully
 */
router.get(
    '/orders/executed',
    [jwtMiddleware, validate(OrderQuerySchema)],
    orderManagementController.getExecutedOrders,
);

/**
 * @swagger
 * /orders/cancelled:
 *   get:
 *     tags: [Orders]
 *     summary: Get all cancelled orders
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by order category (INSTANT, NORMAL, ICEBERG, COVER_ORDER)
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of results per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of cancelled orders retrieved successfully
 */
router.get(
    '/orders/cancelled',
    [jwtMiddleware, validate(OrderQuerySchema)],
    orderManagementController.getCancelledOrders,
);

/**
 * @swagger
 * /orders/rejected:
 *   get:
 *     tags: [Orders]
 *     summary: Get all rejected orders
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by order category (INSTANT, NORMAL, ICEBERG, COVER_ORDER)
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of results per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of rejected orders retrieved successfully
 */
router.get(
    '/orders/rejected',
    [jwtMiddleware, validate(OrderQuerySchema)],
    orderManagementController.getRejectedOrders,
);

/**
 * @swagger
 * /orders/instant:
 *   post:
 *     tags: [Orders]
 *     summary: Create an instant order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InstantOrderSchema'
 *     responses:
 *       201:
 *         description: Instant order created successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
    '/orders/instant',
    [jwtMiddleware, validate(InstantOrderSchema)],
    orderManagementController.createInstantOrder,
);

/**
 * @swagger
 * /orders/normal:
 *   post:
 *     tags: [Orders]
 *     summary: Create a normal order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NormalOrderSchema'
 *     responses:
 *       201:
 *         description: Normal order created successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
    '/orders/normal',
    [jwtMiddleware, validate(NormalOrderSchema)],
    orderManagementController.createNormalOrder,
);

/**
 * @swagger
 * /orders/iceberg:
 *   post:
 *     tags: [Orders]
 *     summary: Create an iceberg order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IcebergOrderSchema'
 *     responses:
 *       201:
 *         description: Iceberg order created successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
    '/orders/iceberg',
    [jwtMiddleware, validate(IcebergOrderSchema)],
    orderManagementController.createIcebergOrder,
);

/**
 * @swagger
 * /orders/cover:
 *   post:
 *     tags: [Orders]
 *     summary: Create a cover order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CoverOrderSchema'
 *     responses:
 *       201:
 *         description: Cover order created successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/orders/cover', [jwtMiddleware, validate(CoverOrderSchema)], orderManagementController.createCoverOrder);

/**
 * @swagger
 * /orders/{order_id}/history:
 *   get:
 *     tags: [Orders]
 *     summary: Get order history
 *     parameters:
 *       - name: order_id
 *         in: path
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order history retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get(
    '/orders/:order_id/history',
    [jwtMiddleware, validate(OrderIdSchema)],
    orderManagementController.getOrderHistory,
);

/**
 * @swagger
 * /orders/recent:
 *   get:
 *     tags: [Orders]
 *     summary: Get recent orders
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of recent orders to return
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recent orders retrieved successfully
 */
router.get('/orders/recent', [jwtMiddleware, validate(OrderLimitSchema)], orderManagementController.getRecentOrders);

export default router;
