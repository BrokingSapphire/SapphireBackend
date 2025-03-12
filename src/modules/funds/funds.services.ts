// funds.services.ts
import { sql } from 'kysely';
import { FundTransaction, UserFunds, MarginTransaction, TradingPosition, WithdrawalRequest } from './funds.types';
import logger from '@app/logger';
import { fundsWsHandler } from './funds.ws';
import { db } from '@app/database';

// Add helper functions for db operations
const dbFunctions = {
    add: (column: string, value: string | number) => sql<number>`${sql.ref(column)} + ${Number(value)}::numeric`,
    subtract: (column: string, value: string | number) => sql<number>`${sql.ref(column)} - ${Number(value)}::numeric`,
};

export class FundsService {
    /**
     * Get a user's funds
     */
    async getUserFunds(userId: number): Promise<UserFunds | null> {
        const funds = await db.selectFrom('user_funds').where('user_id', '=', userId).selectAll().executeTakeFirst();

        return funds || null; // Make sure to handle undefined as null
    }

    /**
     * Initialize user funds if they don't exist
     */
    async initializeUserFunds(userId: number): Promise<UserFunds> {
        const newFunds = await db.transaction().execute(async (trx) => {
            const inserted = await trx
                .insertInto('user_funds')
                .values({
                    user_id: userId,
                    total_funds: 0,
                    available_funds: 0,
                    blocked_funds: 0,
                    used_funds: 0,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returningAll()
                .executeTakeFirst();

            return inserted as UserFunds; // Type assertion to handle undefined
        });

        return newFunds;
    }

    /**
     * Check if a bank account exists and belongs to the user
     */
    async verifyBankAccount(userId: number, bankAccountId: number): Promise<boolean> {
        const bankAccount = await db
            .selectFrom('bank_to_user')
            .where('user_id', '=', userId)
            .where('bank_account_id', '=', bankAccountId)
            .executeTakeFirst();

        return !!bankAccount;
    }

    /**
     * Add funds (immediate deposit)
     */
    async addFunds(userId: number, amount: number, bankAccountId: number, remarks?: string): Promise<FundTransaction> {
        const result = await db.transaction().execute(async (trx) => {
            // Create transaction record as completed immediately
            const transaction = await trx
                .insertInto('fund_transactions')
                .values({
                    user_id: userId,
                    transaction_type: 'deposit',
                    amount: amount,
                    status: 'completed',
                    bank_account_id: bankAccountId,
                    remarks: remarks || null,
                    transaction_date: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returningAll()
                .executeTakeFirst();

            // Get user funds
            let userFunds = await trx
                .selectFrom('user_funds')
                .where('user_id', '=', userId)
                .selectAll()
                .executeTakeFirst();

            // Initialize user funds if they don't exist
            if (!userFunds) {
                await trx
                    .insertInto('user_funds')
                    .values({
                        user_id: userId,
                        total_funds: amount,
                        available_funds: amount,
                        blocked_funds: 0,
                        used_funds: 0,
                        created_at: new Date(),
                        updated_at: new Date(),
                    })
                    .execute();
            } else {
                // Update user funds immediately
                await trx
                    .updateTable('user_funds')
                    .set({
                        total_funds: dbFunctions.add('total_funds', amount),
                        available_funds: dbFunctions.add('available_funds', amount),
                        updated_at: new Date(),
                    })
                    .where('user_id', '=', userId)
                    .execute();
            }

            return transaction as FundTransaction; // Type assertion to handle undefined
        });

        return result;
    }

    /**
     * Complete a pending deposit
     */
    async completeFundDeposit(transactionId: number): Promise<FundTransaction> {
        const result = await db.transaction().execute(async (trx) => {
            // Get transaction details
            const transaction = await trx
                .selectFrom('fund_transactions')
                .where('id', '=', transactionId)
                .selectAll()
                .executeTakeFirst();

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.transaction_type !== 'deposit') {
                throw new Error('Transaction is not a deposit');
            }

            if (transaction.status !== 'pending') {
                throw new Error('Transaction is not in pending status');
            }

            // Update transaction status
            const updatedTransaction = await trx
                .updateTable('fund_transactions')
                .set({
                    status: 'completed',
                    updated_at: new Date(),
                })
                .where('id', '=', transactionId)
                .returningAll()
                .executeTakeFirst();

            // Update user funds
            await trx
                .updateTable('user_funds')
                .set({
                    total_funds: dbFunctions.add('total_funds', transaction.amount),
                    available_funds: dbFunctions.add('available_funds', transaction.amount),
                    updated_at: new Date(),
                })
                .where('user_id', '=', transaction.user_id)
                .execute();

            return updatedTransaction as FundTransaction; // Type assertion to handle undefined
        });

        return result;
    }

    /**
     * Create a withdrawal request
     */
    async withdrawFunds(
        userId: number,
        amount: number,
        bankAccountId: number,
        remarks?: string,
    ): Promise<FundTransaction> {
        const result = await db.transaction().execute(async (trx) => {
            // Get user funds
            const userFunds = await trx
                .selectFrom('user_funds')
                .where('user_id', '=', userId)
                .selectAll()
                .executeTakeFirst();

            if (!userFunds) {
                throw new Error('User funds not found');
            }

            // Check if user has sufficient available funds
            if (Number(userFunds.available_funds) < amount) {
                throw new Error('Insufficient funds for withdrawal');
            }

            // Create withdrawal transaction
            const transaction = await trx
                .insertInto('fund_transactions')
                .values({
                    user_id: userId,
                    transaction_type: 'withdrawal',
                    amount: amount,
                    status: 'pending',
                    bank_account_id: bankAccountId,
                    remarks: remarks || null,
                    transaction_date: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returningAll()
                .executeTakeFirst();

            // Block funds for withdrawal
            await trx
                .updateTable('user_funds')
                .set({
                    available_funds: dbFunctions.subtract('available_funds', amount),
                    blocked_funds: dbFunctions.add('blocked_funds', amount),
                    updated_at: new Date(),
                })
                .where('user_id', '=', userId)
                .execute();

            return transaction as FundTransaction; // Type assertion to handle undefined
        });

        return result;
    }

    /**
     * Process a withdrawal with safety cut for F&O
     */
    async processWithdrawal(
        userId: number,
        amount: number,
        bankAccountId: number,
        remarks?: string,
    ): Promise<WithdrawalRequest> {
        // Validate amount is positive
        if (amount <= 0) {
            throw new Error('Withdrawal amount must be positive');
        }

        // Verify bank account belongs to user first
        const bankAccountExists = await this.verifyBankAccount(userId, bankAccountId);
        if (!bankAccountExists) {
            throw new Error('Invalid bank account');
        }

        // Get user funds, margin details, and check if user has F&O enabled
        const [userFunds, userMargin, foPositions] = await Promise.all([
            db.selectFrom('user_funds').where('user_id', '=', userId).selectAll().executeTakeFirst(),

            db.selectFrom('user_margin').where('user_id', '=', userId).selectAll().executeTakeFirst(),

            db
                .selectFrom('trading_positions')
                .where('user_id', '=', userId)
                .where('trade_type', 'in', ['equity_futures', 'equity_options'])
                .selectAll()
                .execute() as unknown as TradingPosition[],
        ]);

        // Check if user has sufficient funds
        if (!userFunds || Number(userFunds.available_funds) < amount) {
            throw new Error('Insufficient funds for withdrawal');
        }

        // Initialize variables for safety cut logic
        let safetyCutPercentage = 0;
        let finalWithdrawalAmount = amount;
        let safetyCutAmount = 0;

        // Apply safety cut logic only if user has F&O positions
        if (foPositions.length > 0) {
            // Calculate total profit/loss from F&O positions
            const totalPnL = foPositions.reduce((sum, position) => sum + Number(position.mtm_pnl || 0), 0);

            // Case 1: If profit is greater than the withdrawal amount, no safety cut
            if (totalPnL >= amount) {
                // No safety cut needed, can withdraw full amount
                safetyCutPercentage = 0;
                safetyCutAmount = 0;
            }
            // Case 2: If there is some profit but less than withdrawal amount, apply safety cut on difference
            else if (totalPnL > 0 && totalPnL < amount) {
                const amountSubjectToSafetyCut = amount - totalPnL;
                safetyCutAmount = amountSubjectToSafetyCut * 0.05; // 5% safety cut
                finalWithdrawalAmount = amount - safetyCutAmount;
                safetyCutPercentage = 5;
            }
            // Case 3: No profit or in loss, apply 5% safety cut on full amount
            else {
                safetyCutAmount = amount * 0.05; // 5% safety cut
                finalWithdrawalAmount = amount - safetyCutAmount;
                safetyCutPercentage = 5;
            }
        }

        // Ensure we don't block more funds than available
        if (Number(userFunds.available_funds) < finalWithdrawalAmount) {
            throw new Error('Insufficient funds after safety cut');
        }

        // Calculate next processing window
        const currentHour = new Date().getHours();
        const currentDate = new Date();
        let processingDate = new Date();
        processingDate.setDate(currentDate.getDate() + 1); // T+1 day

        const processingWindow = currentHour < 14 ? 'NOON' : 'EVENING';

        if (processingWindow === 'NOON') {
            processingDate.setHours(12, 0, 0, 0);
        } else {
            processingDate.setHours(18, 0, 0, 0);
        }

        // Create withdrawal request
        const transaction = await db.transaction().execute(async (trx) => {
            // Block the funds immediately
            await trx
                .updateTable('user_funds')
                .set({
                    available_funds: dbFunctions.subtract('available_funds', amount),
                    blocked_funds: dbFunctions.add('blocked_funds', finalWithdrawalAmount),
                    updated_at: new Date(),
                })
                .where('user_id', '=', userId)
                .execute();

            // If there's a safety cut, create a record and add to margin
            if (safetyCutAmount > 0) {
                // Record the safety cut as a margin transaction
                await trx
                    .insertInto('margin_transactions')
                    .values({
                        user_id: userId,
                        transaction_type: 'safety_cut',
                        amount: safetyCutAmount,
                        reason: 'F&O position safety margin cut (5%)',
                        created_at: new Date(),
                        updated_at: new Date(),
                    })
                    .execute();

                // Add the safety cut amount back to margin
                if (userMargin) {
                    await trx
                        .updateTable('user_margin')
                        .set({
                            available_margin: dbFunctions.add('available_margin', safetyCutAmount),
                            total_margin: dbFunctions.add('total_margin', safetyCutAmount),
                            updated_at: new Date(),
                        })
                        .where('user_id', '=', userId)
                        .execute();
                }
            }

            // Create withdrawal transaction
            const withdrawal = await trx
                .insertInto('fund_transactions')
                .values({
                    user_id: userId,
                    transaction_type: 'withdrawal',
                    amount: finalWithdrawalAmount,
                    original_amount: amount,
                    safety_cut_amount: safetyCutAmount,
                    safety_cut_percentage: safetyCutPercentage,
                    bank_account_id: bankAccountId,
                    status: 'pending',
                    scheduled_processing_time: processingDate,
                    processing_window: processingWindow,
                    transaction_date: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                    remarks: remarks || `Scheduled for T+1 ${processingWindow === 'NOON' ? '12PM-2PM' : '6PM-8PM'}`,
                })
                .returningAll()
                .executeTakeFirst();

            if (!withdrawal) {
                throw new Error('Failed to create withdrawal');
            }

            return withdrawal;
        });

        // Prepare response with additional data
        const result: WithdrawalRequest = {
            ...transaction,
            processingTime: transaction.scheduled_processing_time,
            window: transaction.processing_window,
            safetyCut: {
                percentage: safetyCutPercentage,
                amount: safetyCutAmount,
                reason: safetyCutAmount > 0 ? 'F&O position safety margin requirement' : null,
                originalAmount: amount,
                finalAmount: finalWithdrawalAmount,
            },
        };

        return result;
    }

    /**
     * Complete a withdrawal
     */
    async completeWithdrawal(transactionId: number): Promise<FundTransaction> {
        const result = await db.transaction().execute(async (trx) => {
            // Get transaction details
            const transaction = await trx
                .selectFrom('fund_transactions')
                .where('id', '=', transactionId)
                .selectAll()
                .executeTakeFirst();

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.transaction_type !== 'withdrawal') {
                throw new Error('Transaction is not a withdrawal');
            }

            if (transaction.status !== 'pending') {
                throw new Error('Transaction is not in pending status');
            }

            // Get current fund values
            const userFunds = await trx
                .selectFrom('user_funds')
                .where('user_id', '=', transaction.user_id)
                .selectAll()
                .executeTakeFirst();

            const amount = Number(transaction.amount);

            // Validate sufficient blocked funds before completing
            if (!userFunds || Number(userFunds.blocked_funds) < amount) {
                throw new Error('Insufficient blocked funds');
            }

            // Update transaction status
            const updatedTransaction = await trx
                .updateTable('fund_transactions')
                .set({
                    status: 'completed',
                    processed_at: new Date(),
                    updated_at: new Date(),
                })
                .where('id', '=', transactionId)
                .returningAll()
                .executeTakeFirst();

            // Update user funds with calculated values
            await trx
                .updateTable('user_funds')
                .set({
                    total_funds: dbFunctions.subtract('total_funds', amount),
                    blocked_funds: dbFunctions.subtract('blocked_funds', amount),
                    updated_at: new Date(),
                })
                .where('user_id', '=', transaction.user_id)
                .execute();

            // Also update user margins
            const userMargin = await trx
                .selectFrom('user_margin')
                .where('user_id', '=', transaction.user_id)
                .selectAll()
                .executeTakeFirst();

            if (userMargin) {
                await trx
                    .updateTable('user_margin')
                    .set({
                        cash_margin: dbFunctions.subtract('cash_margin', amount),
                        total_margin: dbFunctions.subtract('total_margin', amount),
                        available_margin: dbFunctions.subtract('available_margin', amount),
                        updated_at: new Date(),
                    })
                    .where('user_id', '=', transaction.user_id)
                    .execute();
            }

            return updatedTransaction as FundTransaction; // Type assertion to handle undefined
        });

        // Notify user via WebSocket after successful completion
        fundsWsHandler.notifyWithdrawalCompleted(result.user_id.toString(), result);

        return result;
    }

    /**
     * Get user transactions with pagination
     */
    async getUserTransactions(userId: number, limit: number = 20, offset: number = 0): Promise<FundTransaction[]> {
        const transactions = await db
            .selectFrom('fund_transactions')
            .where('user_id', '=', userId)
            .orderBy('transaction_date', 'desc')
            .limit(limit)
            .offset(offset)
            .selectAll()
            .execute();

        return transactions as FundTransaction[]; // Type assertion
    }

    /**
     * Get a transaction by ID
     */
    async getTransactionById(transactionId: number): Promise<FundTransaction | null> {
        const transaction = await db
            .selectFrom('fund_transactions')
            .where('id', '=', transactionId)
            .selectAll()
            .executeTakeFirst();

        return transaction ? (transaction as FundTransaction) : null; // Type assertion and null check
    }

    /**
     * Get user withdrawals
     */
    async getUserWithdrawals(userId: number): Promise<FundTransaction[]> {
        const withdrawals = await db
            .selectFrom('fund_transactions')
            .where('user_id', '=', userId)
            .where('transaction_type', '=', 'withdrawal')
            .orderBy('created_at', 'desc')
            .selectAll()
            .execute();

        return withdrawals as FundTransaction[]; // Type assertion
    }

    /**
     * Get a withdrawal by ID
     */
    async getWithdrawalById(withdrawalId: number): Promise<FundTransaction | null> {
        const withdrawal = await db
            .selectFrom('fund_transactions')
            .where('id', '=', withdrawalId)
            .where('transaction_type', '=', 'withdrawal')
            .selectAll()
            .executeTakeFirst();

        return withdrawal ? (withdrawal as FundTransaction) : null; // Type assertion and null check
    }

    /**
     * Process scheduled withdrawals
     */
    async processScheduledWithdrawals(): Promise<void> {
        try {
            const currentHour = new Date().getHours();
            const isWithinWindow = (currentHour >= 12 && currentHour < 14) || (currentHour >= 18 && currentHour < 20);
            if (!isWithinWindow) {
                return;
            }

            const currentWindow = currentHour < 14 ? 'NOON' : 'EVENING';

            // Get all pending withdrawals for current window
            const pendingWithdrawals = await db
                .selectFrom('fund_transactions')
                .where('status', '=', 'pending')
                .where('transaction_type', '=', 'withdrawal')
                .where('processing_window', '=', currentWindow)
                .where('scheduled_processing_time', '<=', new Date())
                .selectAll()
                .execute();

            // Process withdrawals in smaller batches to avoid memory issues
            const batchSize = 50;
            for (let i = 0; i < pendingWithdrawals.length; i += batchSize) {
                const batch = pendingWithdrawals.slice(i, i + batchSize);
                await Promise.all(batch.map((withdrawal) => this.completeWithdrawal(withdrawal.id)));
            }
        } catch (error) {
            logger.error('Error processing scheduled withdrawals:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }
}

// Create singleton instance
export const fundsService = new FundsService();
