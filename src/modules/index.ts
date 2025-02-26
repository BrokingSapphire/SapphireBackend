import { Router } from 'express';
import { env } from '@app/env';
import logger from '@app/logger';
import signupRouter from './signup/signup.ws';

const router = Router();

const apiPath = env.apiPath;

router.use(`${apiPath}/auth`, signupRouter);
logger.info(`API routes registered at ${apiPath}`);

export default router;
