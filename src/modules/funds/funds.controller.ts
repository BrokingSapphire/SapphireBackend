// funds.controller.ts

import { Request, Response } from 'express';
import { fundsService } from './funds.services';
import { fundsWsHandler } from './funds.ws';
import { DepositRequest, WithdrawalProcessRequest, FundsResponse } from './funds.types';
import logger from '@app/logger';

/**
 * Get user funds
 */
const getUserFunds = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);

        // Get user funds
        let userFunds = await fundsService.getUserFunds(userId);

        // Initialize funds if they don't exist
        if (!userFunds) {
            const newFunds = await fundsService.initializeUserFunds(userId);

            res.status(200).json({
                success: true,
                data: newFunds,
                message: 'User funds initialized',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: userFunds,
        });
    } catch (error) {
        logger.error('Error fetching user funds:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user funds',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Add funds (deposit) - MODIFIED for immediate deposit
 */
const addFunds = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);
        const { amount, bankAccountId, remarks } = req.body as DepositRequest;

        // Check if bank account exists and belongs to the user
        const bankExists = await fundsService.verifyBankAccount(userId, bankAccountId);
        if (!bankExists) {
            res.status(404).json({
                success: false,
                message: 'Bank account not found or does not belong to user',
            });
            return;
        }

        // Process deposit immediately
        const result = await fundsService.addFunds(userId, amount, bankAccountId, remarks);

        // Notify user via WebSocket if connected
        fundsWsHandler.notifyFundDepositCompleted(userId.toString(), result);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Deposit processed successfully',
        });
    } catch (error) {
        logger.error('Error processing deposit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process deposit',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Complete deposit - Not needed for immediate deposits, but kept for backwards compatibility
 */
const completeFundDeposit = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactionId = parseInt(req.params.transactionId);

        const result = await fundsService.completeFundDeposit(transactionId);

        // Notify user via WebSocket
        fundsWsHandler.notifyFundDepositCompleted(result.user_id.toString(), result);

        res.status(200).json({
            success: true,
            data: result,
            message: 'Deposit completed successfully',
        });
    } catch (error) {
        logger.error('Error completing deposit:', error);

        // Handle specific errors
        if (error instanceof Error) {
            if (
                error.message === 'Transaction not found' ||
                error.message === 'Transaction is not a deposit' ||
                error.message === 'Transaction is not in pending status'
            ) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to complete deposit',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Withdraw funds - standard withdrawal
 */
const withdrawFunds = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);
        const { amount, bankAccountId, remarks } = req.body as WithdrawalProcessRequest;

        // Create withdrawal request and update funds
        const result = await fundsService.withdrawFunds(userId, amount, bankAccountId, remarks);

        // Notify user via WebSocket
        fundsWsHandler.notifyFundWithdrawalInitiated(userId.toString(), result);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Withdrawal request created successfully',
        });
    } catch (error) {
        logger.error('Error creating withdrawal request:', error);

        // Handle specific errors
        if (error instanceof Error) {
            if (error.message === 'User funds not found') {
                res.status(404).json({
                    success: false,
                    message: error.message,
                });
                return;
            } else if (error.message === 'Insufficient funds for withdrawal') {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create withdrawal request',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Complete withdrawal
 */
const completeWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactionId = parseInt(req.params.transactionId);

        const result = await fundsService.completeWithdrawal(transactionId);

        // Notify user via WebSocket
        fundsWsHandler.notifyFundWithdrawalCompleted(result.user_id.toString(), result);

        res.status(200).json({
            success: true,
            data: result,
            message: 'Withdrawal completed successfully',
        });
    } catch (error) {
        logger.error('Error completing withdrawal:', error);

        // Handle specific errors
        if (error instanceof Error) {
            if (
                error.message === 'Transaction not found' ||
                error.message === 'Transaction is not a withdrawal' ||
                error.message === 'Transaction is not in pending status'
            ) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to complete withdrawal',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get user transactions
 */
const getUserTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        const transactions = await fundsService.getUserTransactions(userId, limit, offset);

        res.status(200).json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        logger.error('Error fetching user transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user transactions',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get transaction by ID
 */
const getTransactionById = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactionId = parseInt(req.params.transactionId);

        const transaction = await fundsService.getTransactionById(transactionId);

        if (!transaction) {
            res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        logger.error('Error fetching transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Enhanced processWithdrawal function with F&O safety feature
 */
const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);
        const { amount, bankAccountId, remarks } = req.body as WithdrawalProcessRequest;

        // Process withdrawal with safety cut logic
        const result = await fundsService.processWithdrawal(userId, amount, bankAccountId, remarks);

        // Notify user via WebSocket
        const wsData = {
            ...result,
            processingTime: result.scheduled_processing_time,
            window: result.processing_window,
            safetyCut: result.safetyCut,
        };

        fundsWsHandler.notifyWithdrawalScheduled(userId.toString(), wsData);

        res.status(200).json({
            success: true,
            data: {
                ...result,
                safetyCut: result.safetyCut,
            },
            message: `Withdrawal of ${result.safetyCut?.finalAmount} scheduled for processing on ${result.scheduled_processing_time?.toLocaleDateString()} at ${result.processing_window === 'NOON' ? '12:00 PM' : '6:00 PM'}${
                result.safetyCut?.amount && Number(result.safetyCut.amount) > 0
                    ? ` (5% safety cut of ${result.safetyCut.amount} applied due to F&O positions)`
                    : ''
            }`,
        });
    } catch (error) {
        logger.error('Error processing withdrawal:', error);

        if (error instanceof Error && error.message === 'Insufficient funds for withdrawal') {
            res.status(400).json({
                success: false,
                message: 'Insufficient funds for withdrawal',
                error: error.message,
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Failed to process withdrawal',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get user withdrawals
 */
const getUserWithdrawals = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId);
        const withdrawals = await fundsService.getUserWithdrawals(userId);

        res.status(200).json({
            success: true,
            data: withdrawals,
        });
    } catch (error) {
        logger.error('Error fetching withdrawals:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch withdrawals',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get withdrawal by ID
 */
const getWithdrawalById = async (req: Request, res: Response): Promise<void> => {
    try {
        const withdrawalId = parseInt(req.params.withdrawalId);
        const withdrawal = await fundsService.getWithdrawalById(withdrawalId);

        if (!withdrawal) {
            res.status(404).json({
                success: false,
                message: 'Withdrawal not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: withdrawal,
        });
    } catch (error) {
        logger.error('Error fetching withdrawal:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch withdrawal',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Process scheduled withdrawals
const processScheduledWithdrawals = async (): Promise<void> => {
    await fundsService.processScheduledWithdrawals();
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
