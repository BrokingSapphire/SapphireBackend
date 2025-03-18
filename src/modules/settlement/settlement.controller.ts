// controller.ts
import { Request, Response } from 'express';
import {
    SettlementWindowResponse,
    ProcessingWindowsResponse,
    TransactionResponse,
    SettlementResponse,
    TransactionWithSettlement,
    Transaction,
} from './settlement.types';
import { SettlementManager } from './settlement.service';
import { db } from '@app/database';

export const settlementController = {
    // Get settlement windows information
    async getSettlementWindows(
        req: Request,
        res: Response<SettlementWindowResponse | TransactionResponse>,
    ): Promise<void> {
        try {
            const withdrawalWindow = SettlementManager.isWithinWithdrawalProcessingWindow();
            const nextProcessing = SettlementManager.getNextWithdrawalProcessingTime();

            res.json({
                success: true,
                data: {
                    isWithinWindow: withdrawalWindow,
                    nextProcessing,
                    currentTime: new Date(),
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching settlement windows',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Get next processing windows
    async getNextProcessingWindows(
        req: Request,
        res: Response<ProcessingWindowsResponse | TransactionResponse>,
    ): Promise<void> {
        try {
            const nextWindows = {
                noon: {
                    start: '12:00 PM',
                    end: '2:00 PM',
                },
                evening: {
                    start: '6:00 PM',
                    end: '8:00 PM',
                },
            };

            res.json({
                success: true,
                data: nextWindows,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching next processing windows',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Get settlement status for a specific transaction
    async getSettlementStatus(req: Request, res: Response<TransactionResponse>): Promise<void> {
        try {
            const transactionId = parseInt(req.params.transactionId, 10);

            if (isNaN(transactionId)) {
                res.status(400).json({
                    success: false,
                    data: null,
                    message: 'Invalid transaction ID',
                });
                return;
            }

            const transaction = (await db
                .selectFrom('fund_transactions')
                .leftJoin('settlement_details', 'fund_transactions.id', 'settlement_details.transaction_id')
                .where('fund_transactions.id', '=', transactionId)
                .select([
                    'fund_transactions.id',
                    'fund_transactions.status',
                    'fund_transactions.scheduled_processing_time',
                    'settlement_details.settlement_status',
                    'settlement_details.settlement_date',
                ])
                .executeTakeFirst()) as TransactionWithSettlement | undefined;

            if (!transaction) {
                res.status(404).json({
                    success: false,
                    data: null,
                    message: 'Transaction not found',
                });
                return;
            }

            res.json({
                success: true,
                data: transaction,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching settlement status',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Process scheduled settlements
    async processScheduledSettlements(req: Request, res: Response<SettlementResponse>): Promise<void> {
        try {
            const result = await SettlementManager.processScheduledSettlements();
            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error processing scheduled settlements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Get pending settlements
    async getPendingSettlements(req: Request, res: Response<TransactionResponse>): Promise<void> {
        try {
            const pendingSettlements = (await db
                .selectFrom('fund_transactions')
                .where('status', '=', 'pending')
                .selectAll()
                .execute()) as Transaction[];

            res.json({
                success: true,
                data: pendingSettlements,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching pending settlements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Get user settlement history
    async getUserSettlementHistory(req: Request, res: Response<TransactionResponse>): Promise<void> {
        try {
            const userId = parseInt(req.params.userId, 10);

            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    data: null,
                    message: 'Invalid user ID',
                });
                return;
            }

            const settlements = (await db
                .selectFrom('fund_transactions')
                .where('user_id', '=', userId)
                .selectAll()
                .execute()) as Transaction[];

            res.json({
                success: true,
                data: settlements,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching user settlement history',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Get settlement by ID
    async getSettlementById(req: Request, res: Response<TransactionResponse>): Promise<void> {
        try {
            const settlementId = parseInt(req.params.settlementId, 10);

            if (isNaN(settlementId)) {
                res.status(400).json({
                    success: false,
                    data: null,
                    message: 'Invalid settlement ID',
                });
                return;
            }

            const settlement = (await db
                .selectFrom('fund_transactions')
                .where('id', '=', settlementId)
                .selectAll()
                .executeTakeFirst()) as Transaction | undefined;

            if (!settlement) {
                res.status(404).json({
                    success: false,
                    data: null,
                    message: 'Settlement not found',
                });
                return;
            }

            res.json({
                success: true,
                data: settlement,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                data: null,
                message: 'Error fetching settlement',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },
};

export default settlementController;
