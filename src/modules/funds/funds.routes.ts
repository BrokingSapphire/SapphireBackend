// funds.routes.ts

import { Router } from 'express';
import { fundsController } from './funds.controller';
import { db } from '../../database';

const router = Router();

// Test routes
router.get('/test/connection', (req, res) => {
  res.json({ message: 'Funds module API is working!' });
});

// Get user funds
router.get('/:userId/funds', fundsController.getUserFunds);

// Add funds (deposit)
router.post('/:userId/deposit', fundsController.addFunds);

// Withdraw funds
router.post('/:userId/withdraw', fundsController.withdrawFunds);

// Process withdrawal with safety cut
router.post('/:userId/withdraw/process', fundsController.processWithdrawal);

// Get user transactions
router.get('/:userId/transactions', fundsController.getUserTransactions);

// Get specific transaction
router.get('/transaction/:transactionId', fundsController.getTransactionById);

// Get user withdrawals
router.get('/:userId/withdrawals', fundsController.getUserWithdrawals);

// Get specific withdrawal
router.get('/withdrawal/:withdrawalId', fundsController.getWithdrawalById);

// Test database connection
router.get('/test/db', async (req, res) => {
  try {
    const result = await db.selectFrom('user_funds')
      .select('id')
      .limit(1)
      .execute();
    res.json({ success: true, message: 'Database connection successful', data: result });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;