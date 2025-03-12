import { Router } from 'express';
import { env } from '@app/env';
import logger from '@app/logger';
import signupRouter from './signup';
import swaggerRouter from '@app/swagger';

const router = Router();

const apiPath = env.apiPath;

router.use(`${apiPath}/auth/signup`, signupRouter);
router.use(`${apiPath}`, swaggerRouter);

logger.info(`API routes registered at ${apiPath}`);

export default router;
