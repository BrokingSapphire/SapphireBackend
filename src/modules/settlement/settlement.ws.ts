// WebSocket handler for settlement related messages

import WebSocket from 'ws';
import { SettlementManager } from './settlement.service';
import { db } from '@app/database';
import { Transaction, Settlement, SettlementWSMessage } from './settlement.types';
import logger from '@app/logger';

// WebSocket Manager to handle client connections
export class WSManager {
    private static instance: WSManager;
    private clients: Map<string, Set<WebSocket>>;

    private constructor() {
        this.clients = new Map<string, Set<WebSocket>>();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): WSManager {
        if (!WSManager.instance) {
            WSManager.instance = new WSManager();
        }

        return WSManager.instance;
    }

    /**
     * Register a client connection with an identifier
     */
    registerClient(id: string, ws: WebSocket): void {
        if (!this.clients.has(id)) {
            this.clients.set(id, new Set<WebSocket>());
        }

        const connections = this.clients.get(id);
        if (connections) {
            connections.add(ws);
        }

        // Add close handler to clean up on disconnect
        ws.on('close', () => {
            this.unregisterClient(id, ws);
        });
    }

    /**
     * Unregister a client connection
     */
    unregisterClient(id: string, ws: WebSocket): void {
        const connections = this.clients.get(id);

        if (connections) {
            connections.delete(ws);

            // If no more connections for this ID, remove the entry
            if (connections.size === 0) {
                this.clients.delete(id);
            }
        }
    }

    /**
     * Get a client connection by ID
     */
    getClient(id: string): WebSocket | undefined {
        const connections = this.clients.get(id);

        if (connections && connections.size > 0) {
            // Return the first connection if there are multiple
            return Array.from(connections)[0];
        }

        return undefined;
    }

    /**
     * Send a message to all connections for a specific ID
     */
    broadcastToId(id: string, message: string): void {
        const connections = this.clients.get(id);

        if (connections) {
            connections.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            });
        }
    }

    /**
     * Send a message to all connected clients
     */
    broadcastToAll(message: string): void {
        this.clients.forEach((connections) => {
            connections.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            });
        });
    }
}

// Get singleton instance of WSManager
export const wsManager = WSManager.getInstance();

// SettlementWS class to handle settlement-related WebSocket messages
export class SettlementWS {
    /**
     * Initialize WebSocket handlers for settlement-related messages
     */
    static initialize(wss: WebSocket.Server): void {
        wss.on('connection', (ws: WebSocket) => {
            // Connection handling is managed by wsManager
            ws.on('message', async (message: WebSocket.Data) => {
                try {
                    const parsedMessage = JSON.parse(message.toString()) as SettlementWSMessage;

                    // Handle settlement-related messages
                    if (parsedMessage.type.startsWith('SETTLEMENT_')) {
                        await this.handleSettlementMessage(ws, parsedMessage);
                    }
                } catch (error) {
                    logger.error('Error processing WebSocket message:', error);
                    ws.send(
                        JSON.stringify({
                            type: 'ERROR',
                            message: 'Failed to process message',
                        }),
                    );
                }
            });
        });
    }

    /**
     * Handle settlement-related WebSocket messages
     */
    private static async handleSettlementMessage(ws: WebSocket, message: SettlementWSMessage): Promise<void> {
        const userId = message.userId;

        if (!userId) {
            ws.send(
                JSON.stringify({
                    type: 'ERROR',
                    message: 'User ID is required',
                }),
            );
            return;
        }

        switch (message.type) {
            case 'SETTLEMENT_STATUS_REQUEST':
                await this.handleStatusRequest(ws, message);
                break;

            case 'SETTLEMENT_SUBSCRIBE':
                await this.handleSubscribe(ws, userId);
                break;

            case 'SETTLEMENT_UNSUBSCRIBE':
                this.handleUnsubscribe(ws, userId);
                break;

            default:
                ws.send(
                    JSON.stringify({
                        type: 'ERROR',
                        message: 'Unknown settlement message type',
                    }),
                );
        }
    }

    /**
     * Handle settlement status request
     */
    private static async handleStatusRequest(ws: WebSocket, message: SettlementWSMessage): Promise<void> {
        try {
            if (message.transactionId) {
                const transaction = (await db
                    .selectFrom('fund_transactions')
                    .where('id', '=', message.transactionId)
                    .selectAll()
                    .executeTakeFirst()) as Transaction | undefined;

                if (transaction) {
                    ws.send(
                        JSON.stringify({
                            type: 'SETTLEMENT_STATUS_RESPONSE',
                            data: {
                                transaction,
                                nextProcessing: SettlementManager.getNextWithdrawalProcessingTime(),
                            },
                        }),
                    );
                } else {
                    ws.send(
                        JSON.stringify({
                            type: 'ERROR',
                            message: 'Transaction not found',
                        }),
                    );
                }
            } else if (message.settlementId) {
                const settlement = (await db
                    .selectFrom('trade_settlements')
                    .where('id', '=', message.settlementId)
                    .selectAll()
                    .executeTakeFirst()) as Settlement | undefined;

                if (settlement) {
                    ws.send(
                        JSON.stringify({
                            type: 'SETTLEMENT_STATUS_RESPONSE',
                            data: {
                                settlement,
                                nextSettlement: SettlementManager.getNextSettlementCycle(),
                            },
                        }),
                    );
                } else {
                    ws.send(
                        JSON.stringify({
                            type: 'ERROR',
                            message: 'Settlement not found',
                        }),
                    );
                }
            } else {
                ws.send(
                    JSON.stringify({
                        type: 'ERROR',
                        message: 'Transaction ID or Settlement ID is required',
                    }),
                );
            }
        } catch (error) {
            logger.error('Error handling settlement status request:', error);
            ws.send(
                JSON.stringify({
                    type: 'ERROR',
                    message: 'Failed to fetch settlement status',
                }),
            );
        }
    }

    /**
     * Handle settlement subscribe request
     */
    private static async handleSubscribe(ws: WebSocket, userId: number): Promise<void> {
        try {
            // Register this connection with the user ID for settlement notifications
            wsManager.registerClient(userId.toString(), ws);

            // Send current settlement windows information
            const withdrawalWindow = SettlementManager.isWithinWithdrawalProcessingWindow();
            const nextProcessing = SettlementManager.getNextWithdrawalProcessingTime();

            // Get user's pending transactions
            const pendingTransactions = await SettlementManager.getPendingSettlements();
            const userTransactions = pendingTransactions.filter((t) => t.user_id === userId);

            ws.send(
                JSON.stringify({
                    type: 'SETTLEMENT_SUBSCRIBE_SUCCESS',
                    data: {
                        withdrawalWindow,
                        nextProcessing,
                        pendingTransactions: userTransactions,
                    },
                }),
            );
        } catch (error) {
            logger.error('Error handling settlement subscribe:', error);
            ws.send(
                JSON.stringify({
                    type: 'ERROR',
                    message: 'Failed to subscribe to settlement updates',
                }),
            );
        }
    }

    /**
     * Handle settlement unsubscribe request
     */
    private static handleUnsubscribe(ws: WebSocket, userId: number): void {
        // Unregister this connection for settlement notifications
        wsManager.unregisterClient(userId.toString(), ws);

        ws.send(
            JSON.stringify({
                type: 'SETTLEMENT_UNSUBSCRIBE_SUCCESS',
            }),
        );
    }

    /**
     * Broadcast settlement window status to all subscribed clients
     */
    static broadcastSettlementWindows(): void {
        const withdrawalWindow = SettlementManager.isWithinWithdrawalProcessingWindow();
        const nextProcessing = SettlementManager.getNextWithdrawalProcessingTime();

        const message = JSON.stringify({
            type: 'SETTLEMENT_WINDOWS_UPDATE',
            data: {
                isWithinWindow: withdrawalWindow,
                nextProcessing,
                currentTime: new Date(),
            },
        });

        wsManager.broadcastToAll(message);
    }

    /**
     * Notify specific user about their settlement status change
     */
    static notifyUser(userId: number, data: any, type: string): void {
        const wsClient = wsManager.getClient(userId.toString());

        if (wsClient) {
            wsClient.send(
                JSON.stringify({
                    type,
                    data,
                }),
            );
        }
    }
}
