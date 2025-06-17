import { Router } from 'express';
import { saveFcmToken } from './fcm.controller';

const router = Router();

/**
 * Save FCM token - Flutter calls this when app starts
 * POST /api/v1/fcm/token
 */

router.post('/token', saveFcmToken);

export default router;
