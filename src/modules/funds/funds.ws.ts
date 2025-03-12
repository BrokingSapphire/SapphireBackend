// import { WebSocket, RawData } from 'ws';
// import { Request } from 'express';
// import logger from '@app/logger';
// import { WebSocketManager, wsManager } from '../../lib/websocket/wsManager';

// /**
//  * WebSocket route for handling funds updates
//  * Provides real-time updates on user funds and balance changes
//  */
// const fundsRouter = (ws: WebSocket, req: Request) => {
//     ws.on('open', () => {
//         logger.info('Funds WebSocket connection opened for user', req.ip);
//     });

//     ws.on('message', async (data: RawData, isBinary: boolean) => {
//         if (!isBinary) {
//             logger.error('Received non-binary data from funds WebSocket');
//             return;
//         }
//     });

//     ws.on('close', () => {
//         logger.info('Funds WebSocket connection closed');
//     });
// };

// export default fundsRouter;

// export const setupFundsWebSocket = (wsManager: WebSocketManager) => {
//   // Handle funds update events
//   wsManager.on('funds:update', (ws: WebSocket, data: any) => {
//     try {
//       const { userId } = data;

//       // Broadcast funds update to specific user
//       wsManager.sendToUser(userId, 'funds:updated', {
//         success: true,
//         data: data
//       });
//     } catch (error) {
//       console.error('Error in funds websocket handler:', error);
//       ws.send(JSON.stringify({
//         event: 'error',
//         data: {
//           message: 'Failed to process funds update'
//         }
//       }));
//     }
//   });

//   // Handle funds balance notification events
//   wsManager.on('funds:balance:notify', (ws: WebSocket, data: any) => {
//     try {
//       const { userId, balance, type } = data;

//       wsManager.sendToUser(userId, 'funds:balance:notification', {
//         success: true,
//         data: {
//           balance,
//           type,
//           timestamp: new Date().toISOString()
//         }
//       });
//     } catch (error) {
//       console.error('Error in funds balance notification handler:', error);
//       ws.send(JSON.stringify({
//         event: 'error',
//         data: {
//           message: 'Failed to send balance notification'
//         }
//       }));
//     }
//   });
// };

// import { WebSocket } from 'ws';
// import { wsManager } from '../../lib/websocket/wsManager';
// import logger from '@app/logger';

// /**
//  * Handles all WebSocket events related to funds operations
//  */
// export class FundsWebSocketHandler {
//   /**
//    * Initialize WebSocket event listeners for funds operations
//    */
//   initialize(): void {
//     this.setupEventListeners();
//     logger.info('Funds WebSocket handler initialized');
//   }

//   /**
//    * Set up event listeners for funds-related WebSocket events
//    */
//   private setupEventListeners(): void {
//     // Example: If you need to handle any incoming fund-specific events
//     wsManager.on('FUND_DEPOSIT_REQUEST', this.handleDepositRequest);
//     wsManager.on('FUND_WITHDRAWAL_REQUEST', this.handleWithdrawalRequest);
//   }

//   /**
//    * Handle deposit request events from clients (if needed)
//    */
//   private handleDepositRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received deposit request via WebSocket', data);
//     // Process the deposit request
//   }

//   /**
//    * Handle withdrawal request events from clients (if needed)
//    */
//   private handleWithdrawalRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received withdrawal request via WebSocket', data);
//     // Process the withdrawal request
//   }

//   /**
//    * Notify user about fund deposit being processed
//    */
//   notifyFundDepositCompleted(userId: string, transactionData: any): void {
//     wsManager.sendToUser(userId, 'FUND_DEPOSIT_COMPLETED', transactionData);
//     logger.debug(`Notified user ${userId} about completed deposit`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about fund withdrawal being initiated
//    */
//   notifyFundWithdrawalInitiated(userId: string, transactionData: any): void {
//     wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_INITIATED', transactionData);
//     logger.debug(`Notified user ${userId} about initiated withdrawal`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about fund withdrawal being completed
//    */
//   notifyFundWithdrawalCompleted(userId: string, transactionData: any): void {
//     wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_COMPLETED', transactionData);
//     logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about scheduled withdrawal
//    */
//   notifyWithdrawalScheduled(userId: string, data: any): void {
//     wsManager.sendToUser(userId, 'WITHDRAWAL_SCHEDULED', data);
//     logger.debug(`Notified user ${userId} about scheduled withdrawal`, { transactionId: data.id });
//   }

//   /**
//    * Notify user about withdrawal completion
//    */
//   notifyWithdrawalCompleted(userId: string, data: any): void {
//     wsManager.sendToUser(userId, 'WITHDRAWAL_COMPLETED', data);
//     logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: data.id });
//   }
// }

// // Create and export a singleton instance
// export const fundsWsHandler = new FundsWebSocketHandler();

// import { WebSocket } from 'ws';
// import { wsManager } from '../../lib/websocket/wsManager';
// import logger from '@app/logger';
// import { FundTransaction, WithdrawalRequest } from './funds.types';

// /**
//  * Handles all WebSocket events related to funds operations
//  */
// export class FundsWebSocketHandler {
//   /**
//    * Initialize WebSocket event listeners for funds operations
//    */
//   initialize(): void {
//     this.setupEventListeners();
//     logger.info('Funds WebSocket handler initialized');
//   }

//   /**
//    * Set up event listeners for funds-related WebSocket events
//    */
//   private setupEventListeners(): void {
//     // Example: If you need to handle any incoming fund-specific events
//     wsManager.on('FUND_DEPOSIT_REQUEST', this.handleDepositRequest);
//     wsManager.on('FUND_WITHDRAWAL_REQUEST', this.handleWithdrawalRequest);
//   }

//   /**
//    * Handle deposit request events from clients (if needed)
//    */
//   private handleDepositRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received deposit request via WebSocket', data);
//     // Process the deposit request
//   }

//   /**
//    * Handle withdrawal request events from clients (if needed)
//    */
//   private handleWithdrawalRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received withdrawal request via WebSocket', data);
//     // Process the withdrawal request
//   }

//   /**
//    * Notify user about fund deposit being processed
//    */
//   notifyFundDepositCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
//     wsManager.sendToUser(userId, 'FUND_DEPOSIT_COMPLETED', transactionData);
//     logger.debug(`Notified user ${userId} about completed deposit`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about fund withdrawal being initiated
//    */
//   notifyFundWithdrawalInitiated(userId: string, transactionData: Partial<FundTransaction>): void {
//     wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_INITIATED', transactionData);
//     logger.debug(`Notified user ${userId} about initiated withdrawal`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about fund withdrawal being completed
//    */
//   notifyFundWithdrawalCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
//     wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_COMPLETED', transactionData);
//     logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: transactionData.id });
//   }

//   /**
//    * Notify user about scheduled withdrawal
//    */
//   notifyWithdrawalScheduled(userId: string, data: WithdrawalRequest): void {
//     wsManager.sendToUser(userId, 'WITHDRAWAL_SCHEDULED', data);
//     logger.debug(`Notified user ${userId} about scheduled withdrawal`, { transactionId: data.id });
//   }

//   /**
//    * Notify user about withdrawal completion
//    */
//   notifyWithdrawalCompleted(userId: string, data: Partial<FundTransaction>): void {
//     wsManager.sendToUser(userId, 'WITHDRAWAL_COMPLETED', data);
//     logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: data.id });
//   }
// }

// // Create and export a singleton instance
// export const fundsWsHandler = new FundsWebSocketHandler();

// import { WebSocket } from 'ws';
// import { wsManager } from '../../lib/websocket/wsManager';
// import logger from '@app/logger';
// import { FundTransaction, WithdrawalRequest } from './funds.types';

// /**
//  * Handles all WebSocket events related to funds operations
//  */
// export class FundsWebSocketHandler {
//   /**
//    * Initialize WebSocket event listeners for funds operations
//    */
//   initialize(): void {
//     this.setupEventListeners();
//     logger.info('Funds WebSocket handler initialized');
//   }

//   /**
//    * Set up event listeners for funds-related WebSocket events
//    */
//   private setupEventListeners(): void {
//     // Example: If you need to handle any incoming fund-specific events
//     wsManager.on('FUND_DEPOSIT_REQUEST', this.handleDepositRequest);
//     wsManager.on('FUND_WITHDRAWAL_REQUEST', this.handleWithdrawalRequest);
//   }

//   /**
//    * Handle deposit request events from clients (if needed)
//    */
//   private handleDepositRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received deposit request via WebSocket', data);
//     // Process the deposit request
//   }

//   /**
//    * Handle withdrawal request events from clients (if needed)
//    */
//   private handleWithdrawalRequest(ws: WebSocket, data: any): void {
//     // Example handler - implement if needed
//     logger.info('Received withdrawal request via WebSocket', data);
//     // Process the withdrawal request
//   }

//   /**
//    * Notify user about fund deposit being processed
//    */
//   notifyFundDepositCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
//     try {
//       wsManager.sendToUser(userId, 'FUND_DEPOSIT_COMPLETED', transactionData);
//       logger.debug(`Notified user ${userId} about completed deposit`, { transactionId: transactionData.id });
//     } catch (error) {
//       logger.error(`Error notifying user ${userId} about deposit completion:`, error);
//     }
//   }

//   /**
//    * Notify user about fund withdrawal being initiated
//    */
//   notifyFundWithdrawalInitiated(userId: string, transactionData: Partial<FundTransaction>): void {
//     try {
//       wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_INITIATED', transactionData);
//       logger.debug(`Notified user ${userId} about initiated withdrawal`, { transactionId: transactionData.id });
//     } catch (error) {
//       logger.error(`Error notifying user ${userId} about withdrawal initiation:`, error);
//     }
//   }

//   /**
//    * Notify user about fund withdrawal being completed
//    */
//   notifyFundWithdrawalCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
//     try {
//       wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_COMPLETED', transactionData);
//       logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: transactionData.id });
//     } catch (error) {
//       logger.error(`Error notifying user ${userId} about withdrawal completion:`, error);
//     }
//   }

//   /**
//    * Notify user about scheduled withdrawal
//    */
//   notifyWithdrawalScheduled(userId: string, data: WithdrawalRequest): void {
//     try {
//       wsManager.sendToUser(userId, 'WITHDRAWAL_SCHEDULED', data);
//       logger.debug(`Notified user ${userId} about scheduled withdrawal`, { transactionId: data.id });
//     } catch (error) {
//       logger.error(`Error notifying user ${userId} about scheduled withdrawal:`, error);
//     }
//   }

//   /**
//    * Notify user about withdrawal completion
//    */
//   notifyWithdrawalCompleted(userId: string, data: Partial<FundTransaction>): void {
//     try {
//       wsManager.sendToUser(userId, 'WITHDRAWAL_COMPLETED', data);
//       logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: data.id });
//     } catch (error) {
//       logger.error(`Error notifying user ${userId} about withdrawal completion:`, error);
//     }
//   }
// }

// // Create and export a singleton instance
// export const fundsWsHandler = new FundsWebSocketHandler();

// funds.ws.ts

import { WebSocket } from 'ws';
import { wsManager } from '../../lib/websocket/wsManager';
import logger from '@app/logger';
import { FundTransaction, WithdrawalRequest } from './funds.types';

/**
 * Handles all WebSocket events related to funds operations
 */
export class FundsWebSocketHandler {
    /**
     * Initialize WebSocket event listeners for funds operations
     */
    initialize(): void {
        this.setupEventListeners();
        logger.info('Funds WebSocket handler initialized');
    }

    /**
     * Set up event listeners for funds-related WebSocket events
     */
    private setupEventListeners(): void {
        // Example: If you need to handle any incoming fund-specific events
        wsManager.on('FUND_DEPOSIT_REQUEST', this.handleDepositRequest);
        wsManager.on('FUND_WITHDRAWAL_REQUEST', this.handleWithdrawalRequest);
    }

    /**
     * Handle deposit request events from clients (if needed)
     */
    private handleDepositRequest(ws: WebSocket, data: any): void {
        // Example handler - implement if needed
        logger.info('Received deposit request via WebSocket', data);
        // Process the deposit request
    }

    /**
     * Handle withdrawal request events from clients (if needed)
     */
    private handleWithdrawalRequest(ws: WebSocket, data: any): void {
        // Example handler - implement if needed
        logger.info('Received withdrawal request via WebSocket', data);
        // Process the withdrawal request
    }

    /**
     * Notify user about fund deposit being processed
     */
    notifyFundDepositCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
        try {
            wsManager.sendToUser(userId, 'FUND_DEPOSIT_COMPLETED', transactionData);
            logger.debug(`Notified user ${userId} about completed deposit`, { transactionId: transactionData.id });
        } catch (error) {
            logger.error(`Error notifying user ${userId} about deposit completion:`, error);
        }
    }

    /**
     * Notify user about fund withdrawal being initiated
     */
    notifyFundWithdrawalInitiated(userId: string, transactionData: Partial<FundTransaction>): void {
        try {
            wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_INITIATED', transactionData);
            logger.debug(`Notified user ${userId} about initiated withdrawal`, { transactionId: transactionData.id });
        } catch (error) {
            logger.error(`Error notifying user ${userId} about withdrawal initiation:`, error);
        }
    }

    /**
     * Notify user about fund withdrawal being completed
     */
    notifyFundWithdrawalCompleted(userId: string, transactionData: Partial<FundTransaction>): void {
        try {
            wsManager.sendToUser(userId, 'FUND_WITHDRAWAL_COMPLETED', transactionData);
            logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: transactionData.id });
        } catch (error) {
            logger.error(`Error notifying user ${userId} about withdrawal completion:`, error);
        }
    }

    /**
     * Notify user about scheduled withdrawal
     */
    notifyWithdrawalScheduled(userId: string, data: WithdrawalRequest): void {
        try {
            wsManager.sendToUser(userId, 'WITHDRAWAL_SCHEDULED', data);
            logger.debug(`Notified user ${userId} about scheduled withdrawal`, { transactionId: data.id });
        } catch (error) {
            logger.error(`Error notifying user ${userId} about scheduled withdrawal:`, error);
        }
    }

    /**
     * Notify user about withdrawal completion
     */
    notifyWithdrawalCompleted(userId: string, data: Partial<FundTransaction>): void {
        try {
            wsManager.sendToUser(userId, 'WITHDRAWAL_COMPLETED', data);
            logger.debug(`Notified user ${userId} about completed withdrawal`, { transactionId: data.id });
        } catch (error) {
            logger.error(`Error notifying user ${userId} about withdrawal completion:`, error);
        }
    }
}

// Create and export a singleton instance
export const fundsWsHandler = new FundsWebSocketHandler();
