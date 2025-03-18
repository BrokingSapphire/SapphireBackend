import express, { Request, Response } from 'express';
import { SettlementManager } from './settlement.service';
import { settlementController } from './settlement.controller';
import { SettlementWindowResponse, ProcessingWindows, ProcessingWindowsResponse } from './settlement.types';

const router = express.Router();

// Settlement window information
router.get('/settlement/windows', (req: Request, res: Response) => {
    const withdrawalWindow = SettlementManager.isWithinWithdrawalProcessingWindow();
    const nextProcessing = SettlementManager.getNextWithdrawalProcessingTime();

    const response: SettlementWindowResponse = {
        success: true,
        data: {
            isWithinWindow: withdrawalWindow,
            nextProcessing,
            currentTime: new Date(),
        },
    };

    res.json(response);
});

// Get next processing windows
router.get('/settlement/next-windows', (req: Request, res: Response) => {
    const nextWindows: ProcessingWindows = {
        noon: {
            start: '12:00 PM',
            end: '2:00 PM',
        },
        evening: {
            start: '6:00 PM',
            end: '8:00 PM',
        },
    };

    const response: ProcessingWindowsResponse = {
        success: true,
        data: nextWindows,
    };

    res.json(response);
});

// Get settlement status for a specific transaction
router.get('/settlement/status/:transactionId', settlementController.getSettlementStatus);

// Get current settlement status and windows
router.get('/settlement/status', settlementController.getSettlementWindows);

// Force process settlements (for testing)
router.post('/settlement/process-now', settlementController.processScheduledSettlements);

// Get all pending settlements
router.get('/settlement/pending', settlementController.getPendingSettlements);

// Get user's settlement history
router.get('/settlement/history/:userId', settlementController.getUserSettlementHistory);

// Get settlement by ID
router.get('/settlement/:settlementId', settlementController.getSettlementById);

export default router;
