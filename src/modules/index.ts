import { Router } from 'express';
import signupRouter from './signup';
import loginRouter from './login';
import fundsRouter from './funds';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';

const router = Router();

router.use('/auth/signup', signupRouter);
router.use('/auth/login', loginRouter);
router.use('/funds', fundsRouter);

router.get('/healthcheck', async (_req, res) => {
    await db.selectFrom('user').where('id', '=', 1).execute();
    res.status(OK).json({ status: 'ok' });
});

export default router;
