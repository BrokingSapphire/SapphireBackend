// funds.routes.ts

import { Router } from 'express';
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
import { db } from '../../database';

const router = Router();

// Test routes
router.get('/test/connection', (req, res) => {
    res.json({ message: 'Funds module API is working!' });
});

// Get user funds
router.get('/:userId/funds', getUserFunds);

// Add funds (deposit)
router.post('/:userId/deposit', addFunds);

// Withdraw funds
router.post('/:userId/withdraw', withdrawFunds);

// Process withdrawal with safety cut
router.post('/:userId/withdraw/process', processWithdrawal);

// Get user transactions
router.get('/:userId/transactions', getUserTransactions);

// Get specific transaction
router.get('/transaction/:transactionId', getTransactionById);

// Get user withdrawals
router.get('/:userId/withdrawals', getUserWithdrawals);

// Get specific withdrawal
router.get('/withdrawal/:withdrawalId', getWithdrawalById);

// Test database connection
router.get('/test/db', async (req, res) => {
    try {
        const result = await db.selectFrom('user_funds').select('id').limit(1).execute();
        res.json({ success: true, message: 'Database connection successful', data: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
