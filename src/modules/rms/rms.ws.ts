// ws.ts
import WebSocket from 'ws';
import { WebSocketMessage } from './rms.types';

class WebSocketManager {
    private clients: Map<string, WebSocket>;

    constructor() {
        this.clients = new Map();
    }

    public addClient(userId: string, ws: WebSocket): void {
        this.clients.set(userId, ws);

        // Remove client when connection is closed
        ws.on('close', () => {
            this.clients.delete(userId);
        });
    }

    public getClient(userId: string): WebSocket | undefined {
        return this.clients.get(userId);
    }

    public removeClient(userId: string): boolean {
        return this.clients.delete(userId);
    }

    public sendMessage(userId: string, message: WebSocketMessage): boolean {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    public broadcastMessage(message: WebSocketMessage): void {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Create and export singleton instance
export const wsManager = new WebSocketManager();
