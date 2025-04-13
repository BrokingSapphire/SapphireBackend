import { Server } from 'socket.io';
import * as TradeService from './trade.service';
import { verifySocketAuth } from './auth';

export const registerTradeSocketHandlers = (io: Server) => {
  // Create namespace for trade
  const tradeNamespace = io.of('/trade');

  tradeNamespace.on('connection', (socket) => {
    console.log(`Client connected to trade socket: ${socket.id}`);

    // Join room for specific instrument type
    socket.on('joinInstrumentRoom', (instrumentType) => {
      if (['stock', 'future', 'option', 'commodity'].includes(instrumentType)) {
        socket.join(instrumentType);
        console.log(`Client ${socket.id} joined ${instrumentType} room`);
      } else {
        socket.emit('error', { message: 'Invalid instrument type' });
      }
    });

    // Handle new trade advice
    socket.on('createTradeAdvice', async (data) => {
      try {
        const { token, tradeAdvice } = data;

        // Verify token
        const user = verifySocketAuth(token);

        if (!user) {
          return socket.emit('error', { message: 'Unauthorized' });
        }

        // Create trade advice
        const result = await TradeService.createTradeAdvice(tradeAdvice, user.id);

        // Emit success to the sender
        socket.emit('tradeAdviceCreated', {
          success: true,
          message: 'Trade advice created successfully',
          data: result
        });

      } catch (error: any) {
        socket.emit('error', {
          message: error.message || 'Failed to create trade advice'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected from trade socket: ${socket.id}`);
    });
  });
};