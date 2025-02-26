import { Router } from 'express';
import signupRouter from './signup.ws';

const router = Router();

router.use('/signup', signupRouter);

export default router;
