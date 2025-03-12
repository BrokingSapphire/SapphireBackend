// // lib/websocket/wsManager.ts

// import { WebSocket, WebSocketServer } from 'ws';
// import { Server } from 'http';
// import logger from '@app/logger';

// interface WSMessage {
//   type: 'REGISTER' | 'REGISTER_USER' | 'PROGRESS_UPDATE';
//   checkpointId?: string;
//   userId?: string;
//   data?: any;
// }

// export class WebSocketManager {
//   private wss!: WebSocketServer;
//   private connections: Map<string, Set<WebSocket>>;
//   private clients: Map<string, WebSocket>;

//   constructor() {
//     this.connections = new Map();
//     this.clients = new Map();
//   }

//   initialize(server: Server): void {
//     this.wss = new WebSocketServer({ server });

//     this.wss.on('connection', (ws: WebSocket) => {
//       logger.info('New WebSocket connection established');

//       ws.on('message', (message: string) => {
//         try {
//           const data: WSMessage = JSON.parse(message.toString());
//           this.handleMessage(ws, data);
//         } catch (error) {
//           logger.error('Error processing message:', error);
//         }
//       });

//       ws.on('close', () => {
//         this.removeConnection(ws);
//       });
//     });
//   }

//   private handleMessage(ws: WebSocket, data: WSMessage): void {
//     switch (data.type) {
//       case 'REGISTER':
//         if (data.checkpointId) {
//           this.registerConnection(data.checkpointId, ws);
//         }
//         break;
//       case 'REGISTER_USER':
//         if (data.userId) {
//           this.clients.set(data.userId.toString(), ws);
//           logger.info(`Registered user connection for user ${data.userId}`);
//         }
//         break;
//       default:
//         logger.warn('Unknown message type:', data.type);
//     }
//   }

//   private registerConnection(checkpointId: string, ws: WebSocket): void {
//     if (!this.connections.has(checkpointId)) {
//       this.connections.set(checkpointId, new Set());
//     }
//     this.connections.get(checkpointId)?.add(ws);
//     logger.info(`Registered connection for checkpoint ${checkpointId}`);
//   }

//   private removeConnection(ws: WebSocket): void {
//     // Remove from connections
//     this.connections.forEach((connections, checkpointId) => {
//       if (connections.has(ws)) {
//         connections.delete(ws);
//         if (connections.size === 0) {
//           this.connections.delete(checkpointId);
//         }
//       }
//     });

//     // Remove from clients
//     this.clients.forEach((client, userId) => {
//       if (client === ws) {
//         this.clients.delete(userId);
//       }
//     });
//   }

//   broadcastProgress(checkpointId: string, data: any): void {
//     if (this.connections.has(checkpointId)) {
//       const message = JSON.stringify({
//         type: 'PROGRESS_UPDATE',
//         data
//       });

//       this.connections.get(checkpointId)?.forEach(client => {
//         if (client.readyState === WebSocket.OPEN) {
//           client.send(message);
//         }
//       });
//     }
//   }

//   getClient(userId: string): WebSocket | undefined {
//     return this.clients.get(userId);
//   }

//   // Add methods for funds.ws.ts to use
//   on(event: string, callback: (ws: WebSocket, data: any) => void): void {
//     this.wss.on('message', (ws: WebSocket) => {
//       ws.on('message', (message: string) => {
//         try {
//           const data = JSON.parse(message.toString());
//           if (data.event === event) {
//             callback(ws, data);
//           }
//         } catch (error) {
//           logger.error(`Error in ${event} handler:`, error);
//         }
//       });
//     });
//   }

//   sendToUser(userId: string, event: string, data: any): void {
//     const client = this.getClient(userId);
//     if (client && client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify({
//         event,
//         data
//       }));
//     }
//   }
// }

// export const wsManager = new WebSocketManager();

// // lib/websocket/wsManager.ts

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import logger from '@app/logger';

export interface WSMessage {
    type: 'REGISTER' | 'REGISTER_USER' | 'PROGRESS_UPDATE' | string;
    checkpointId?: string;
    userId?: string;
    data?: any;
    event?: string;
}

export class WebSocketManager {
    private wss!: WebSocketServer;
    private connections: Map<string, Set<WebSocket>>;
    private clients: Map<string, WebSocket>;

    constructor() {
        this.connections = new Map();
        this.clients = new Map();
    }

    initialize(server: Server): void {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws: WebSocket) => {
            logger.info('New WebSocket connection established');

            ws.on('message', (message: string) => {
                try {
                    const data: WSMessage = JSON.parse(message.toString());
                    this.handleMessage(ws, data);
                } catch (error) {
                    logger.error('Error processing message:', error);
                }
            });

            ws.on('close', () => {
                this.removeConnection(ws);
            });
        });
    }

    private handleMessage(ws: WebSocket, data: WSMessage): void {
        switch (data.type) {
            case 'REGISTER':
                if (data.checkpointId) {
                    this.registerConnection(data.checkpointId, ws);
                }
                break;
            case 'REGISTER_USER':
                if (data.userId) {
                    this.clients.set(data.userId.toString(), ws);
                    logger.info(`Registered user connection for user ${data.userId}`);
                }
                break;
            default:
                // Handle custom events by delegating to any registered event handlers
                this.triggerEvent(data.type, ws, data);
        }
    }

    private registerConnection(checkpointId: string, ws: WebSocket): void {
        if (!this.connections.has(checkpointId)) {
            this.connections.set(checkpointId, new Set());
        }
        this.connections.get(checkpointId)?.add(ws);
        logger.info(`Registered connection for checkpoint ${checkpointId}`);
    }

    private removeConnection(ws: WebSocket): void {
        // Remove from connections
        this.connections.forEach((connections, checkpointId) => {
            if (connections.has(ws)) {
                connections.delete(ws);
                if (connections.size === 0) {
                    this.connections.delete(checkpointId);
                }
            }
        });

        // Remove from clients
        this.clients.forEach((client, userId) => {
            if (client === ws) {
                this.clients.delete(userId);
            }
        });
    }

    broadcastProgress(checkpointId: string, data: any): void {
        if (this.connections.has(checkpointId)) {
            const message = JSON.stringify({
                type: 'PROGRESS_UPDATE',
                data,
            });

            this.connections.get(checkpointId)?.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    getClient(userId: string): WebSocket | undefined {
        return this.clients.get(userId);
    }

    // Event handling system
    private eventHandlers: Map<string, Set<(ws: WebSocket, data: any) => void>> = new Map();

    on(event: string, callback: (ws: WebSocket, data: any) => void): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)?.add(callback);
    }

    private triggerEvent(event: string, ws: WebSocket, data: any): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(ws, data);
                } catch (error) {
                    logger.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    sendToUser(userId: string, event: string, data: any): void {
        const client = this.getClient(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(
                JSON.stringify({
                    event,
                    data,
                }),
            );
        }
    }
}

export const wsManager = new WebSocketManager();
