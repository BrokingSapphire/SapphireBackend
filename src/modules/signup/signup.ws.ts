// signup.ws.ts

import { WebSocket, RawData } from 'ws';
import { Request } from 'express';
import logger from '@app/logger';
/**
 * WebSocket route for handling signup process
 * Provides real-time updates on signup progress
 */
const signupRouter = (ws: WebSocket, req: Request) => {
    ws.on('open', () => {
        logger.info('Signup WebSocket connection opened for user', req.ip);
    });

    ws.on('message', async (data: RawData, isBinary: boolean) => {
        if (!isBinary) {
            logger.error('Received non-binary data from signup WebSocket');
            return;
        }
    });

    ws.on('close', () => {
        logger.info('Signup WebSocket connection closed');
    });
};

export default signupRouter;
