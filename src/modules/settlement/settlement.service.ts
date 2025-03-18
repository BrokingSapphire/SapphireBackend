// manager.ts
import logger from '@app/logger';
import { Transaction, Order, Settlement, ProcessingTimeInfo, WebSocketManager } from './settlement.types';
import { db } from '@app/database';

export class SettlementManager {
    private static wsManager: WebSocketManager;

    /**
     * Initialize the settlement manager with the websocket manager
     * @param wsManager WebSocket manager instance
     */
    static initialize(wsManager: WebSocketManager): void {
        this.wsManager = wsManager;
    }

    /**
     * Check if current time is within the settlement window
     * @returns True if current time is within settlement window
     */
    static isWithinSettlementWindow(): boolean {
        const now = new Date();
        const hours = now.getHours();

        // Settlement window: 12AM - 7AM
        return hours >= 0 && hours < 7;
    }

    /**
     * Check if current time is within withdrawal request window
     * @returns True if current time is within withdrawal request window
     */
    static isWithinWithdrawalRequestWindow(): boolean {
        const now = new Date();
        const hours = now.getHours();

        // Withdrawal request windows: 7AM-12PM and 12PM-6PM
        return hours >= 7 && hours < 18;
    }

    /**
     * Check if current time is within withdrawal processing window
     * @returns True if current time is within withdrawal processing window
     */
    static isWithinWithdrawalProcessingWindow(): boolean {
        const now = new Date();
        const hours = now.getHours();

        // Withdrawal processing windows: 12PM-2PM and 6PM-8PM
        return (hours >= 12 && hours < 14) || (hours >= 18 && hours < 20);
    }

    /**
     * Get the next settlement cycle time
     * @returns Next settlement cycle start time
     */
    static getNextSettlementCycle(): Date {
        const now = new Date();
        const nextSettlement = new Date(now);

        // If current time is before midnight or after 7AM, set to next day midnight
        if (now.getHours() >= 7) {
            nextSettlement.setDate(now.getDate() + 1);
        }

        nextSettlement.setHours(0, 0, 0, 0);
        return nextSettlement;
    }

    /**
     * Get the next withdrawal processing time
     * @returns Object containing next processing time and window information
     */
    static getNextWithdrawalProcessingTime(): ProcessingTimeInfo {
        const now = new Date();
        const nextProcessing = new Date(now);
        let windowDescription = '';

        const hours = now.getHours();

        if (hours < 12) {
            // Before noon, next processing is at noon
            nextProcessing.setHours(12, 0, 0, 0);
            windowDescription = 'Noon processing window (12PM-2PM)';
        } else if (hours < 18) {
            // Before 6PM, next processing is at 6PM
            nextProcessing.setHours(18, 0, 0, 0);
            windowDescription = 'Evening processing window (6PM-8PM)';
        } else {
            // After 6PM, next processing is at noon the next day
            nextProcessing.setDate(now.getDate() + 1);
            nextProcessing.setHours(12, 0, 0, 0);
            windowDescription = 'Next day noon processing window (12PM-2PM)';
        }

        return {
            nextProcessing,
            windowDescription,
        };
    }

    /**
     * Queue a withdrawal for the next processing cycle
     * @param transactionData Withdrawal transaction data
     * @returns Updated transaction with scheduling info
     */
    static async queueWithdrawal(
        transactionData: Transaction,
    ): Promise<Transaction & { processingInfo: ProcessingTimeInfo }> {
        const nextProcessingInfo = this.getNextWithdrawalProcessingTime();

        // Add scheduling information to the transaction
        return await db.transaction().execute(async (trx) => {
            // Update the transaction with scheduling information
            const updatedTransaction = await trx
                .updateTable('fund_transactions')
                .set({
                    scheduled_processing_time: nextProcessingInfo.nextProcessing,
                    remarks: transactionData.remarks
                        ? `${transactionData.remarks} | Scheduled for ${nextProcessingInfo.windowDescription}`
                        : `Scheduled for ${nextProcessingInfo.windowDescription}`,
                    updated_at: new Date(),
                })
                .where('id', '=', transactionData.id)
                .returningAll()
                .executeTakeFirst();

            return {
                ...(updatedTransaction as Transaction),
                processingInfo: nextProcessingInfo,
            };
        });
    }

    /**
     * Queue a settlement for the next settlement cycle
     * @param orderData Order data to be settled
     * @returns Updated order with settlement info
     */
    /**
     * Queue a settlement for the next settlement cycle
     * @param orderData Order data to be settled
     * @returns Updated order with settlement info
     */
    /**
     * Queue a settlement for the next settlement cycle
     * @param orderData Order data to be settled
     * @returns Updated order with settlement info
     */
    static async queueSettlement(orderData: Order): Promise<Settlement> {
        const nextSettlement = this.getNextSettlementCycle();

        // Add settlement information to the order
        return await db.transaction().execute(async (trx) => {
            // Create a settlement record without explicit type annotation
            const settlementData = {
                order_id: orderData.id,
                user_id: orderData.user_id,
                trade_type: orderData.trade_type,
                settlement_amount: orderData.total_value || 0,
                status: 'scheduled',
                scheduled_settlement_time: nextSettlement,
                created_at: new Date(),
            };

            // Insert the settlement record with type assertion
            const settlement = await trx
                .insertInto('trade_settlements')
                .values(settlementData as any) // Use type assertion to bypass type checking
                .returningAll()
                .executeTakeFirst();

            // Notify user via WebSocket
            const wsClient = this.wsManager.getClient(orderData.user_id.toString());
            if (wsClient) {
                wsClient.send(
                    JSON.stringify({
                        type: 'TRADE_SETTLEMENT_SCHEDULED',
                        data: {
                            settlement,
                            order: orderData,
                        },
                    }),
                );
            }

            return settlement as Settlement;
        });
    }
    /**
     * Process scheduled withdrawals that are due
     * @returns Array of processed withdrawals
     */
    static async processScheduledWithdrawals(): Promise<Transaction[]> {
        // Only run this if we're in the withdrawal processing window
        if (!this.isWithinWithdrawalProcessingWindow()) {
            logger.info('Not within withdrawal processing window. Skipping processing.');
            return [];
        }

        const now = new Date();

        try {
            return await db.transaction().execute(async (trx) => {
                // Find all scheduled withdrawals that are due
                const pendingWithdrawals = await trx
                    .selectFrom('fund_transactions')
                    .where('transaction_type', '=', 'withdrawal')
                    .where('status', '=', 'pending')
                    .where('scheduled_processing_time', '<=', now)
                    .selectAll()
                    .execute();

                const processedWithdrawals: Transaction[] = [];

                // Process each withdrawal
                for (const withdrawal of pendingWithdrawals as Transaction[]) {
                    try {
                        // Get user funds
                        const userFunds = await trx
                            .selectFrom('user_funds')
                            .where('user_id', '=', withdrawal.user_id)
                            .selectAll()
                            .executeTakeFirst();

                        const amount = Number(withdrawal.amount);

                        // Update transaction status
                        const updatedWithdrawal = await trx
                            .updateTable('fund_transactions')
                            .set({
                                status: 'processing' as const,
                                updated_at: now,
                            })
                            .where('id', '=', withdrawal.id)
                            .returningAll()
                            .executeTakeFirst();

                        // Add to processed list
                        processedWithdrawals.push(updatedWithdrawal as Transaction);

                        // Notify user via WebSocket
                        const wsClient = this.wsManager.getClient(withdrawal.user_id.toString());
                        if (wsClient) {
                            wsClient.send(
                                JSON.stringify({
                                    type: 'FUND_WITHDRAWAL_PROCESSING',
                                    data: updatedWithdrawal,
                                }),
                            );
                        }
                    } catch (error) {
                        logger.error(`Error processing withdrawal ID ${withdrawal.id}:`, error);
                    }
                }

                return processedWithdrawals;
            });
        } catch (error) {
            logger.error('Error in batch processing withdrawals:', error);
            return [];
        }
    }

    /**
     * Process the settlement cycle
     * @returns Array of processed settlements
     */
    static async processSettlementCycle(): Promise<Settlement[]> {
        // Only run this if we're in the settlement window
        if (!this.isWithinSettlementWindow()) {
            logger.info('Not within settlement window. Skipping settlement.');
            return [];
        }

        const now = new Date();

        try {
            return await db.transaction().execute(async (trx) => {
                // Find all scheduled settlements that are due
                const pendingSettlements = await trx
                    .selectFrom('trade_settlements')
                    .where('status', '=', 'scheduled')
                    .where('scheduled_settlement_time', '<=', now)
                    .selectAll()
                    .execute();

                const processedSettlements: Settlement[] = [];

                // Process each settlement
                for (const settlement of pendingSettlements as Settlement[]) {
                    try {
                        // Get the order details
                        const order = await trx
                            .selectFrom('trading_orders')
                            .where('id', '=', settlement.order_id)
                            .selectAll()
                            .executeTakeFirst();

                        if (!order) {
                            logger.error(`Order not found for settlement ID ${settlement.id}`);
                            continue;
                        }

                        // Update settlement status
                        const updatedSettlement = await trx
                            .updateTable('trade_settlements')
                            .set({
                                status: 'processing' as const,
                                updated_at: now,
                            })
                            .where('id', '=', settlement.id)
                            .returningAll()
                            .executeTakeFirst();

                        // Add to processed list
                        processedSettlements.push(updatedSettlement as Settlement);

                        // Notify user via WebSocket
                        const wsClient = this.wsManager.getClient(settlement.user_id.toString());
                        if (wsClient) {
                            wsClient.send(
                                JSON.stringify({
                                    type: 'TRADE_SETTLEMENT_PROCESSING',
                                    data: {
                                        settlement: updatedSettlement,
                                        order,
                                    },
                                }),
                            );
                        }
                    } catch (error) {
                        logger.error(`Error processing settlement ID ${settlement.id}:`, error);
                    }
                }

                return processedSettlements;
            });
        } catch (error) {
            logger.error('Error in batch processing settlements:', error);
            return [];
        }
    }

    /**
     * Get all pending settlements
     * @returns Array of pending settlements
     */
    static async getPendingSettlements(): Promise<Settlement[]> {
        try {
            // Get all scheduled settlements
            const pendingSettlements = await db
                .selectFrom('trade_settlements')
                .where('status', '=', 'scheduled')
                .selectAll()
                .execute();

            return pendingSettlements as Settlement[];
        } catch (error) {
            logger.error('Error fetching pending settlements:', error);
            return [];
        }
    }

    /**
     * Process scheduled settlements
     * @returns Array of processed settlements
     */
    static async processScheduledSettlements(): Promise<Settlement[]> {
        return this.processSettlementCycle();
    }
}

export default SettlementManager;
