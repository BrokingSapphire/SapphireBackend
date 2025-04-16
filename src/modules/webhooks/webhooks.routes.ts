import { Router } from 'express';
import { depositCallback } from './webhooks.controller';

const router = Router();

router.route('/deposit/callback').get(depositCallback).post(depositCallback);

export default router;
