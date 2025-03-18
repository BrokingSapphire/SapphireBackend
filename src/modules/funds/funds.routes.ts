// funds.routes.ts
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

const router = Router();

// Test routes
router.get('/test/connection', (req, res) => {
    res.json({ message: 'Funds module API is working!' });
});

// Get user funds
router.get('/:userId/funds', validate(UserIdSchema), getUserFunds);

// Add funds (deposit)
router.post('/:userId/deposit', 
    validate(UserIdSchema), 
    validate(DepositRequestSchema), 
    addFunds
);

// Withdraw funds
router.post('/:userId/withdraw', 
    validate(UserIdSchema), 
    validate(WithdrawalRequestSchema), 
    withdrawFunds
);

// Process withdrawal with safety cut
router.post('/:userId/withdraw/process', 
    validate(UserIdSchema), 
    validate(WithdrawalRequestSchema), 
    processWithdrawal
);

// Get user transactions
router.get('/:userId/transactions', 
    validate(UserIdSchema), 
    validate(PaginationSchema), 
    getUserTransactions
);

// Get specific transaction
router.get('/transaction/:transactionId', 
    validate(TransactionIdSchema), 
    getTransactionById
);

// Get user withdrawals
router.get('/:userId/withdrawals', 
    validate(UserIdSchema), 
    validate(PaginationSchema), 
    getUserWithdrawals
);

// Get specific withdrawal
router.get('/withdrawal/:withdrawalId', 
    validate(TransactionIdSchema), 
    getWithdrawalById
);

export default router;