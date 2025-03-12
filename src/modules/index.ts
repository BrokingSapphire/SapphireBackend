import { Router } from 'express';
import { env } from '@app/env';
import logger from '@app/logger';
import signupRouter from './signup';

const router = Router();

const apiPath = env.apiPath;

router.use(`${apiPath}/auth/signup`, signupRouter);
logger.info(`API routes registered at ${apiPath}`);

export default router;
