import { Router } from 'express';
import { RequestOtpSchema, VerifyOtpSchema } from './login.validator';
import { validate } from '@app/middlewares';
import { requestOtp, verifyOtp } from './login.controller';

const router = Router();

router.post('/request-otp', validate(RequestOtpSchema), requestOtp);
router.post('/verify-otp', validate(VerifyOtpSchema), verifyOtp);

export default router;
