import { Router } from 'express';
import signupRouter from './signup';
import fundsRouter from './funds';
import webhookRouter from './webhooks';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';
import redisClient from '@app/services/redis.service';
import complianceRouter from './compliance';
import watchlistRouter from './watchlist';
import { jwtMiddleware } from '@app/utils/jwt';

const router = Router();

router.use('/auth/signup', signupRouter);
router.use('/compliance', jwtMiddleware, complianceRouter);
router.use('/funds', jwtMiddleware, fundsRouter);
router.use('/watchlist', jwtMiddleware, watchlistRouter);
router.use('/webhook', webhookRouter);

router.get('/healthcheck', async (_req, res) => {
    await db.selectFrom('user').where('id', '=', 1).execute();
    await redisClient.ping();
    res.status(OK).json({ status: 'ok' });
});

export default router;
