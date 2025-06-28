import { Router } from 'express';
import { depositCallback } from './webhooks.controller';
import { validate } from '@app/middlewares';
import { DepositCallbackBody, DepositCallbackQuery } from '@app/modules/webhooks/webhook.validator';

const router = Router();

router.post(
    '/deposit/callback',
    validate(DepositCallbackBody),
    validate(DepositCallbackQuery, 'query'),
    depositCallback,
);

export default router;
