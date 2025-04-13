import { Router } from 'express';
import * as TradeController from './trade.controller';
import { authenticate } from './auth';

const router = Router();

// POST /api/trade - Create trade advice (protected)
router.post('/', authenticate, TradeController.createTradeAdvice);

// GET /api/trade - Get all trade advice
router.get('/', TradeController.getTradeAdvice);

// GET /api/trade/:id - Get trade advice by ID
router.get('/:id', TradeController.getTradeAdvice);

export default router;