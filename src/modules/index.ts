import { Router } from 'express';
import signupRouter from './signup';
import loginRouter from './login';
import fundsRouter from './funds';
import fcmRouter from './firebase-cloud-messaging';
import webhookRouter from './webhooks';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';
import redisClient from '@app/services/redis.service';
import complianceRouter from './compliance';
import watchlistRouter from './watchlist';
import { jwtMiddleware } from '@app/utils/jwt';
import { sql } from 'kysely';

const router = Router();

router.use('/auth/signup', signupRouter);
router.use('/auth/login', loginRouter);
router.use('/compliance', complianceRouter);
router.use('/fcm', fcmRouter);
router.use('/funds', jwtMiddleware, fundsRouter);
router.use('/watchlist', jwtMiddleware, watchlistRouter);
router.use('/webhook', webhookRouter);

router.get('/healthcheck', async (_req, res) => {
    await sql`SELECT 1;`.execute(db);
    await redisClient.ping();
    res.status(OK).json({ status: 'ok' });
});

export default router;
