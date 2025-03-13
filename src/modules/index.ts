import { Router } from 'express';
import { env } from '@app/env';
import logger from '@app/logger';
import signupRouter from './signup';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';

const router = Router();

const apiPath = env.apiPath;

router.use(`${apiPath}/auth/signup`, signupRouter);

router.get(`${apiPath}/healthcheck`, async (_req, res) => {
    await db.selectFrom('user').where('id', '=', 1).execute();
    res.status(OK).json({ status: 'ok' });
});

logger.info(`API routes registered at ${apiPath}`);

export default router;
