import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    getUserFunds,
    depositFunds,
    withdrawFunds,
    getUserTransactions,
    getTransactionInfo,
    getBankAccounts,
} from './funds.controller';
import { DepositRequestSchema, WithdrawalRequestSchema } from './funds.validator';

/**
 * @swagger
 * tags:
 *   name: Funds
 *   description: Funds and transactions management endpoints
 */
const router = Router();

/**
 * @swagger
 * /funds/{userId}/funds:
 *   get:
 *     tags: [Funds]
 *     summary: Get user funds
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User funds retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 */
router.get('/', getUserFunds);

/**
 * @swagger
 * /funds/{userId}/deposit:
 *   post:
 *     tags: [Funds]
 *     summary: Add funds (deposit)
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepositRequestSchema'
 *     responses:
 *       200:
 *         description: Funds added successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/deposit', validate(DepositRequestSchema), depositFunds);

/**
 * @swagger
 * /funds/{userId}/withdraw:
 *   post:
 *     tags: [Funds]
 *     summary: Withdraw funds
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WithdrawalRequestSchema'
 *     responses:
 *       200:
 *         description: Withdrawal request processed
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/withdraw', validate(WithdrawalRequestSchema), withdrawFunds);

/**
 * @swagger
 * /funds/accounts:
 *   get:
 *     tags: [Funds]
 *     summary: Get user bank accounts
 *     responses:
 *       200:
 *         description: Bank accounts retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/accounts', getBankAccounts);

/**
 * @swagger
 * /funds/{userId}/transactions:
 *   get:
 *     tags: [Funds]
 *     summary: Get user transactions
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User transactions retrieved successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.get('/transactions', getUserTransactions);

/**
 * @swagger
 * /funds/transaction/{transactionId}:
 *   get:
 *     tags: [Funds]
 *     summary: Get specific transaction
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         description: Transaction ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 *       400:
 *         description: Invalid transaction ID
 *       404:
 *         description: Transaction not found
 */
router.get('/transaction/:id', getTransactionInfo);

export default router;
