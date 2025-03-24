import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    getUserFunds,
    addFunds,
    withdrawFunds,
    processWithdrawal,
    getUserTransactions,
    getTransactionById,
    getUserWithdrawals,
    getWithdrawalById,
} from './funds.controller';
import { 
    DepositRequestSchema, 
    WithdrawalRequestSchema, 
    TransactionIdSchema,
    UserIdSchema,
    PaginationSchema 
} from './funds.validator';

/**
 * @swagger
 * tags:
 *   name: Funds
 *   description: Funds and transactions management endpoints
 */
const router = Router();

/**
 * @swagger
 * /funds/test/connection:
 *   get:
 *     tags: [Funds]
 *     summary: Test API connection
 *     responses:
 *       200:
 *         description: API connection successful
 */
router.get('/test/connection', (req, res) => {
    res.json({ message: 'Funds module API is working!' });
});

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
router.get('/:userId/funds', validate(UserIdSchema), getUserFunds);

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
router.post('/:userId/deposit', 
    validate(UserIdSchema), 
    validate(DepositRequestSchema), 
    addFunds
);

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
router.post('/:userId/withdraw', 
    validate(UserIdSchema), 
    validate(WithdrawalRequestSchema), 
    withdrawFunds
);

/**
 * @swagger
 * /funds/{userId}/withdraw/process:
 *   post:
 *     tags: [Funds]
 *     summary: Process withdrawal with safety cut
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
 *         description: Withdrawal processed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/withdraw/process', 
    validate(UserIdSchema), 
    validate(WithdrawalRequestSchema), 
    processWithdrawal
);

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
router.get('/:userId/transactions', 
    validate(UserIdSchema), 
    validate(PaginationSchema), 
    getUserTransactions
);

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
router.get('/transaction/:transactionId', 
    validate(TransactionIdSchema), 
    getTransactionById
);

/**
 * @swagger
 * /funds/{userId}/withdrawals:
 *   get:
 *     tags: [Funds]
 *     summary: Get user withdrawals
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
 *         description: User withdrawals retrieved successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.get('/:userId/withdrawals', 
    validate(UserIdSchema), 
    validate(PaginationSchema), 
    getUserWithdrawals
);

/**
 * @swagger
 * /funds/withdrawal/{withdrawalId}:
 *   get:
 *     tags: [Funds]
 *     summary: Get specific withdrawal
 *     parameters:
 *       - name: withdrawalId
 *         in: path
 *         required: true
 *         description: Withdrawal ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal retrieved successfully
 *       400:
 *         description: Invalid withdrawal ID
 *       404:
 *         description: Withdrawal not found
 */
router.get('/withdrawal/:withdrawalId', 
    validate(TransactionIdSchema), 
    getWithdrawalById
);

export default router;