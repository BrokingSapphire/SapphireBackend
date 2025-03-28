// funds.controller.ts

import { Request, Response } from 'express';
import  {fundsService}  from './funds.services';
import { APIError, BadRequestError, ForbiddenError, NotFoundError } from '@app/apiError';
import { db } from '@app/database';
import { DepositRequest, WithdrawalProcessRequest } from './funds.types';
import logger from '@app/logger';
import { CREATED, OK } from '@app/utils/httpstatus';

/**
 * Get user funds
 */
const getUserFunds = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }

    let userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select(['id', 'user_id', 'available_funds', 'blocked_funds', 'total_funds', 'used_funds'])
        .executeTakeFirst();

    if (!userFunds) {
        userFunds = await db.transaction().execute(async (tx) => {
            const inserted = await tx
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

            return inserted;
        });
    }

    res.status(OK).json({
        message: 'User funds fetched successfully',
        data: userFunds
    });
};

/**
 * Add funds to user account
 */

const addFunds = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);
    const { amount, bankAccountId, remarks } = req.body as DepositRequest;

    // checking for valid input
    if (!amount || amount <= 0) {
        throw new BadRequestError('Invalid deposit amount');
    }

    if (!bankAccountId) {
        throw new BadRequestError('Bank account ID is required');
    }

    // Check bank account verification status
    const bankAccount = await db
        .selectFrom('bank_account')
        .where('id', '=', bankAccountId)
        .select(['verification_status', 'account_no', 'ifsc_code'])
        .executeTakeFirst();

    if (!bankAccount) {
        throw new NotFoundError('Bank account not found');
    }

    if (bankAccount.verification_status !== 'verified') {
        throw new ForbiddenError('Bank account is not verified');
    }

    // Check if bank account belongs to the user
    const bankToUser = await db
        .selectFrom('bank_to_user')
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bankAccountId)
        .select(['bank_account_id'])
        .executeTakeFirst();

    if (!bankToUser) {
        throw new ForbiddenError('Bank account does not belong to this user');
    }

    // Depositing Funds 
    const result = await db.transaction().execute(async (tx) => {
        const fundTransaction = await tx
            .insertInto('fund_transactions')
            .values({
                user_id: userId,
                bank_account_id: bankAccountId,
                amount: amount,
                transaction_type: 'deposit',
                status: 'completed',
                transaction_date: new Date(),
                remarks: remarks || 'Deposit',
                processed_at: new Date()
            })
            .returningAll()
            .executeTakeFirst();

        // Update user funds
        await tx
            .updateTable('user_funds')
            .set({
                available_funds: eb => eb('available_funds', '+', amount),
                total_funds: eb => eb('total_funds', '+', amount),
                updated_at: new Date()
            })
            .where('user_id', '=', userId)
            .execute();

        return fundTransaction;
    });

    res.status(CREATED).json({
        message: 'Deposit processed successfully',
        data: result
    });
};

/**
 * Complete deposit - Not needed for immediate deposits, but kept for backwards compatibility
 */
const completeFundDeposit = async (req: Request, res: Response): Promise<void> => {
    const transactionId = parseInt(req.params.transactionId);

    if (isNaN(transactionId)) {
        throw new BadRequestError('Invalid transaction ID');
    }

    const result = await db.transaction().execute(async (tx) => {
        const transaction = await tx
            .selectFrom('fund_transactions')
            .where('id', '=', transactionId)
            .selectAll()
            .executeTakeFirst();

        if (!transaction) {
            throw new NotFoundError('Transaction not found');
        }
        if (transaction.transaction_type !== 'deposit') {
            throw new BadRequestError('Transaction is not a deposit');
        }

        if (transaction.status !== 'pending') {
            throw new BadRequestError('Transaction is not in pending status');
        }

        // Update transaction status
        const updatedTransaction = await tx
            .updateTable('fund_transactions')
            .set({
                status: 'completed',
                processed_at: new Date(),
                updated_at: new Date(),
            })
            .where('id', '=', transactionId)
            .returningAll()
            .executeTakeFirst();

        // Update user funds
        await tx
            .updateTable('user_funds')
            .set({
                total_funds: eb => eb('total_funds', '+', transaction.amount),
                available_funds: eb => eb('available_funds', '+', transaction.amount),
                updated_at: new Date(),
            })
            .where('user_id', '=', transaction.user_id)
            .execute();

        return updatedTransaction;
    });
    res.status(OK).json({
        message: 'Deposit completed successfully',
        data: result
    });
};

/**
 * Withdraw funds - standard withdrawal
 */
const withdrawFunds = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);
    const { amount, bankAccountId, remarks } = req.body as WithdrawalProcessRequest;

    if (!amount || amount <= 0) {
        throw new BadRequestError('Invalid withdrawal amount');
    }

    if (!bankAccountId) {
        throw new BadRequestError('Bank account ID is required');
    }

    // Create withdrawal request and update funds
    const result = await db.transaction().execute(async (trx) => {
        const bankToUser = await trx
            .selectFrom('bank_to_user')
            .where('user_id', '=', userId)
            .where('bank_account_id', '=', bankAccountId)
            .executeTakeFirst();

        if (!bankToUser) {
            throw new ForbiddenError('Bank account does not belong to this user');
        }

        // Get user funds
        const userFunds = await trx
            .selectFrom('user_funds')
            .where('user_id', '=', userId)
            .selectAll()
            .executeTakeFirst();

        if (!userFunds) {
            throw new NotFoundError('User funds not found');
        }
        // Check if user has sufficient funds
        if (userFunds.available_funds < amount) {
            throw new BadRequestError('Insufficient funds for withdrawal');
        }
        
        const fundTransaction = await trx
            .insertInto('fund_transactions')
            .values({
                user_id: userId,
                bank_account_id: bankAccountId,
                amount: amount,
                transaction_type: 'withdrawal',
                status: 'pending',
                transaction_date: new Date(),
                remarks: remarks || 'Withdrawal request',
                scheduled_processing_time: new Date(Date.now() + 24 * 60 * 60 * 1000) // Schedule for next day
            })
            .returningAll()
            .executeTakeFirst();

        // Updating User funds after withdrawal 
        await trx
            .updateTable('user_funds')
            .set({
                available_funds: eb => eb('available_funds', '-', amount),
                blocked_funds: eb => eb('blocked_funds', '+', amount),
                updated_at: new Date()
            })
            .where('user_id', '=', userId)
            .execute();

        return fundTransaction;
    });

    res.status(CREATED).json({
        message: 'Withdrawal request created successfully',
        data: result
    });
};

/**
 * Complete withdrawal
 */
const completeWithdrawal = async (req: Request, res: Response): Promise<void> => {
    const transactionId = parseInt(req.params.transactionId);

    if (isNaN(transactionId)) {
        throw new BadRequestError('Invalid transaction ID');
    }

    const result = await db.transaction().execute(async (tx) => {
        const transaction = await tx
            .selectFrom('fund_transactions')
            .where('id', '=', transactionId)
            .selectAll()
            .executeTakeFirstOrThrow();

        if (transaction.status !== 'pending') {
            throw new BadRequestError('Transaction is not in pending status');
        }
        // updating transaction status

        const updatedTransaction = await tx
            .updateTable('fund_transactions')
            .set({
                status: 'completed',
                processed_at: new Date(),
                updated_at: new Date(),
            })
            .where('id', '=', transactionId)
            .returningAll()
            .executeTakeFirst();

        // reducing funds of user
        await tx
            .updateTable('user_funds')
            .set({
                total_funds: eb => eb('total_funds', '-', transaction.amount),
                blocked_funds: eb => eb('blocked_funds', '-', transaction.amount),
                updated_at: new Date(),
            })
            .where('user_id', '=', transaction.user_id)
            .execute();

        return updatedTransaction;
    });

    res.status(OK).json({
        message: 'Withdrawal completed successfully',
        data: result
    });
};
/**
 * Get user transactions
 */
const getUserTransactions = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
        throw new BadRequestError("Invalid User ID");
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    if (isNaN(limit) || limit <= 0 || isNaN(offset) || offset < 0) {
        throw new BadRequestError('Invalid pagination parameters');
    }

    // fetching transactions
    const transactions = await db
        .selectFrom('fund_transactions')
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .selectAll()
        .execute();

    const countResult = await db
        .selectFrom('fund_transactions')
        .where('user_id', '=', userId)
        .select(db.fn.count('id').as('total'))
        .executeTakeFirst();

    const total = countResult ? Number(countResult.total) : 0;

    res.status(OK).json({
        message: 'Users Transaction Fetched Successfully',
        data: {
            transactions,
            pagination: {
                total,
                page: Math.floor(offset / limit) + 1,
                limit,
                pages: Math.ceil(total / limit)
            }
        }
    });
};

/**
 * Get transaction by ID
 */
const getTransactionById = async (req: Request, res: Response): Promise<void> => {
    const transactionId = parseInt(req.params.transactionId);

    if (isNaN(transactionId)) {
        throw new BadRequestError('Invalid transaction ID');
    }

    const transaction = await db
        .selectFrom('fund_transactions')
        .where('id', '=', transactionId)
        .select([
            'id',
            'user_id',
            'amount',
            'transaction_type',
            'status',
            'bank_account_id'
        ])
        .executeTakeFirst();

    if (!transaction) {
        throw new NotFoundError('Transaction Req. not found');
    }

    if (req.query.includeBankDetails === 'true') {
        const bankDetails = await db
            .selectFrom('bank_account')
            .where('id', '=', transaction.bank_account_id)
            .select([
                'account_holder_name',
                'account_no',
                'ifsc_code',
                'bank_name',
                'branch_name'
            ])
            .executeTakeFirst();

        res.status(OK).json({
            message: 'Transaction details fetched successfully',
            data: {
                ...transaction,
                bankDetails
            }
        });
        return;
    }

    res.status(OK).json({
        message: 'Transaction details fetched successfully',
        data: transaction
    });
};

/**
 * Enhanced processWithdrawal function with F&O safety feature
 */
// const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const userId = parseInt(req.params.userId);

//         if (isNaN(userId)) {
//             throw new BadRequestError('Invalid user ID');
//         }

//         const { amount, bankAccountId, remarks } = req.body as WithdrawalProcessRequest;

//         if (!amount || amount <= 0) {
//             throw new BadRequestError('Invalid withdrawal amount');
//         }
        
//         if (!bankAccountId) {
//             throw new BadRequestError('Bank account ID is required');
//         }

//         // Check if bank account belongs to the user
//         const bankToUser = await db
//             .selectFrom('bank_to_user')
//             .where('user_id', '=', userId)
//             .where('bank_account_id', '=', bankAccountId)
//             .executeTakeFirst();
            
//         if (!bankToUser) {
//             throw new ForbiddenError('Bank account does not belong to this user');
//         }

//         // checking available USers fund
//         const userFunds = await db
//             .selectFrom('user_funds')
//             .where('user_id', '=', userId)
//             .selectAll()
//             .executeTakeFirst();
            
//         if (!userFunds) {
//             throw new NotFoundError('User funds not found');
//         }
        
//         if (userFunds.available_funds < amount) {
//             throw new BadRequestError( 'Insufficient funds for withdrawal');
//         }

//         // Check for F&O positions to determine if safety cut is needed
//         const hasActivePositions = await db
//             .selectFrom('trading_positions')
//             .where('user_id', '=', userId)
//             .where(eb => 
//                 eb.or([
//                     eb('trade_type', '=', 'equity_futures'),
//                     eb('trade_type', '=', 'equity_options'),
//                     eb('trade_type', '=', 'currency_futures'),
//                     eb('trade_type', '=', 'currency_options'),
//                     eb('trade_type', '=', 'commodity_futures'),
//                     eb('trade_type', '=', 'commodity_options')
//                 ])
//             )
//             .executeTakeFirst();

//              // Apply safety cut logic
//         let finalAmount = amount;
//         let safetyCut = {
//             applied: false,
//             amount: 0,
//             percentage: 5,
//             finalAmount: amount
//         };

//         if (hasActivePositions) {
//             // Apply 5% safety cut for users with F&O positions
//             safetyCut.applied = true;
//             safetyCut.amount = amount * 0.05;
//             finalAmount = amount - safetyCut.amount;
//             safetyCut.finalAmount = finalAmount;
//         }

//         const currentHour = new Date().getHours();
//         const processingWindow = currentHour < 12 ? 'NOON' : 'EOD';

//         const now = new Date();
//         let scheduledTime = new Date();
        
//         if (processingWindow === 'NOON') {
//             // Set to noon today
//             scheduledTime.setHours(12, 0, 0, 0);
            
//             // If it's already past noon, schedule for next day
//             if (now > scheduledTime) {
//                 scheduledTime.setDate(scheduledTime.getDate() + 1);
//             }
//         }else{
//             scheduledTime.setHours(18, 0, 0, 0);
            
//             // If it's already past 6 PM, schedule for next day
//             if (now > scheduledTime) {
//                 scheduledTime.setDate(scheduledTime.getDate() + 1);
//             }
//         }
//         const result = await db.transaction().execute(async (trx) => {
//             // Create fund transaction record
//             const fundTransaction = await trx
//                 .insertInto('fund_transactions')
//                 .values({
//                     user_id: userId,
//                     bank_account_id: bankAccountId,
//                     amount: finalAmount,
//                     original_amount: amount,
//                     transaction_type: 'withdrawal',
//                     status: 'pending',
//                     transaction_date: new Date(),
//                     remarks: remarks || 'Withdrawal request',
//                     scheduled_processing_time: scheduledTime,
//                     processing_window: processingWindow,
//                     safety_cut_amount: safetyCut.applied ? safetyCut.amount : null,
//                     safety_cut_percentage: safetyCut.applied ? safetyCut.percentage : null
//                 })
//                 .returningAll()
//                 .executeTakeFirst();
            
//             await trx
//             .updateTable('user_funds')
//             .set({
//                 available_funds: eb => eb('available_funds', '-', amount),
//                 blocked_funds: eb => eb('blocked_funds', '+', finalAmount),
//                 updated_at: new Date()
//             })
//             .where('user_id', '=', userId)
//             .execute();
//             return {
//                 ...fundTransaction,
//                 safetyCut
//             };
//         });

//         res.status(CREATED).json({
//             message: 'Withdrawal request processed successfully',
//             data: result
//         });
//     } catch (error) {
//         logger.error('Error processing withdrawal:', error);
        
//         if (error instanceof APIError) {
//             res.status(error.status).json({
//                 message: error.message
//             });
//         } else {
//             res.status(500).json({
//                 error: 'Internal server error'
//             });
//         }
//     }
// };



/**
 * Enhanced processWithdrawal function with F&O safety feature
 */
const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }

    const { amount, bankAccountId, remarks } = req.body as WithdrawalProcessRequest;

    if (!amount || amount <= 0) {
        throw new BadRequestError('Invalid withdrawal amount');
    }

    if (!bankAccountId) {
        throw new BadRequestError('Bank account ID is required');
    }

    // Check if bank account belongs to the user
    const bankToUser = await db
        .selectFrom('bank_to_user')
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bankAccountId)
        .executeTakeFirst();

    if (!bankToUser) {
        throw new ForbiddenError('Bank account does not belong to this user');
    }

    // checking available Users fund
    const userFunds = await db
        .selectFrom('user_funds')
        .where('user_id', '=', userId)
        .select([
            'id',
            'user_id',
            'available_funds'
        ])
        .executeTakeFirst();

    if (!userFunds) {
        throw new NotFoundError('User funds not found');
    }

    if (userFunds.available_funds < amount) {
        throw new BadRequestError('Insufficient funds for withdrawal');
    }

    // checking for F&O 
    const hasActivePositions = await db
    .selectFrom('trading_positions')
    .where('user_id', '=', userId)
    .where(eb => 
        eb.or([
            eb('trade_type', '=', 'equity_futures'),
            eb('trade_type', '=', 'equity_options'),
            eb('trade_type', '=', 'currency_futures'),
            eb('trade_type', '=', 'currency_options'),
            eb('trade_type', '=', 'commodity_futures'),
            eb('trade_type', '=', 'commodity_options')
        ])
    )
    .select('id')
    .limit(1)
    .executeTakeFirst();

    // Calculate safety cut
    const { safetyCut } = fundsService.calculateSafetyCut(!!hasActivePositions, amount);

    if (!safetyCut || typeof safetyCut.finalAmount === 'undefined') {
        throw new Error('Failed to Calculate Safety Cut');
    }

    // Prepare scheduled processing time
    const { processingWindow, scheduledTime } = fundsService.prepareScheduledProcessingTime();

    const result = await db.transaction().execute(async (trx) => {
        // Create fund transaction record
        const fundTransaction = await trx
            .insertInto('fund_transactions')
            .values({
                user_id: userId,
                bank_account_id: bankAccountId,
                amount: safetyCut.finalAmount as number,
                original_amount: amount,
                transaction_type: 'withdrawal',
                status: 'pending',
                transaction_date: new Date(),
                remarks: remarks || 'Withdrawal request',
                scheduled_processing_time: scheduledTime,
                processing_window: processingWindow,
                safety_cut_amount: safetyCut?.reason ? safetyCut.amount as number : null,
                safety_cut_percentage: safetyCut?.reason ? safetyCut.percentage : null
            })
            .returningAll()
            .executeTakeFirst();

        await trx
            .updateTable('user_funds')
            .set({
                available_funds: eb => eb('available_funds', '-', amount),
                blocked_funds: eb => eb('blocked_funds', '+', safetyCut.finalAmount as number),
                updated_at: new Date()
            })
            .where('user_id', '=', userId)
            .execute();
            
        return {
            ...fundTransaction,
            safetyCut
        };
    });

    res.status(CREATED).json({
        message: 'Withdrawal request processed successfully',
        data: result
    });
};

/**
* Get user withdrawals
*/
const getUserWithdrawals = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
    }

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
        throw new BadRequestError('Invalid pagination parameters');
    }

    const offset = (page - 1) * limit;

    const withdrawals = await db
        .selectFrom('fund_transactions')
        .where('user_id', '=', userId)
        .where('transaction_type', '=', 'withdrawal')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .selectAll()
        .execute();

    const countResult = await db
        .selectFrom('fund_transactions')
        .where('user_id', '=', userId)
        .where('transaction_type', '=', 'withdrawal')
        .select(db.fn.count('id').as('total'))
        .executeTakeFirst();

    const total = countResult ? Number(countResult.total) : 0;

    res.status(OK).json({
        message: 'User withdrawals fetched successfully',
        data: {
            withdrawals,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                hasMore: offset + withdrawals.length < total
            }
        }
    });
};

/**
 * Get withdrawal by ID
 */
const getWithdrawalById = async (req: Request, res: Response): Promise<void> => {
    const withdrawalId = parseInt(req.params.withdrawalId);

    if (isNaN(withdrawalId)) {
        throw new BadRequestError('Invalid withdrawal ID');
    }

    const withdrawal = await db
        .selectFrom('fund_transactions')
        .where('id', '=', withdrawalId)
        .where('transaction_type', '=', 'withdrawal')
        .selectAll()
        .executeTakeFirst();

    if (!withdrawal) {
        throw new NotFoundError('Withdrawal Not found');
    }

    // If the request includes bankDetails=true, include bank information
    if (req.query.includeBankDetails === 'true') {
        const bankDetails = await db
            .selectFrom('bank_account')
            .where('id', '=', withdrawal.bank_account_id)
            .select([
                'account_holder_name',
                'account_no',
                'ifsc_code',
                'bank_name',
                'branch_name'
            ])
            .executeTakeFirst();

        res.status(OK).json({
            message: 'Withdrawal details fetched successfully',
            data: {
                ...withdrawal,
                bankDetails
            }
        });
        return;
    }

    res.status(OK).json({
        message: 'Withdrawal details fetched successfully',
        data: withdrawal
    });
};

/**
 * Process scheduled withdrawals
 */
const processScheduledWithdrawals = async (): Promise<void> => {
    logger.info('Processing scheduled withdrawals');

    const now = new Date();

    // Finding all pending withdrawals scheduled for processing
    const pendingWithdrawals = await db
        .selectFrom('fund_transactions')
        .where('transaction_type', '=', 'withdrawal')
        .where('status', '=', 'pending')
        .where('scheduled_processing_time', '<=', now)
        .select([
            'id',
            'user_id',
            'amount'
        ])
        .execute();

    logger.info(`Found ${pendingWithdrawals.length} withdrawals to process`);

    for (const withdrawal of pendingWithdrawals) {
        try {
            await db.transaction().execute(async (tx) => {
                // Update transaction status
                await tx
                    .updateTable('fund_transactions')
                    .set({
                        status: 'completed',
                        processed_at: new Date(),
                        updated_at: new Date()
                    })
                    .where('id', '=', withdrawal.id)
                    .execute();

                // Update user funds
                await tx
                    .updateTable('user_funds')
                    .set({
                        total_funds: eb => eb('total_funds', '-', withdrawal.amount),
                        blocked_funds: eb => eb('blocked_funds', '-', withdrawal.amount),
                        updated_at: new Date()
                    })
                    .where('user_id', '=', withdrawal.user_id)
                    .execute();
            });

            logger.info(`Successfully processed withdrawal ID: ${withdrawal.id}`);
        } catch (error) {
            logger.error(`Error processing withdrawal ID: ${withdrawal.id}`, error);
        }
    }
};

// Schedule the job to run every hour
setInterval(processScheduledWithdrawals, 60 * 60 * 1000);

export {
    getUserFunds,
    addFunds,
    completeFundDeposit,
    withdrawFunds,
    completeWithdrawal,
    getUserTransactions,
    getTransactionById,
    processWithdrawal,
    getUserWithdrawals,
    getWithdrawalById,
};