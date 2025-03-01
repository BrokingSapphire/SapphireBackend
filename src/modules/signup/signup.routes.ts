import { Router } from 'express';
import { CheckpointSchema, RequestOtpSchema, VerifyOtpSchema } from './signup.validator';
import { validate } from '@app/middlewares';
import { requestOtp, verifyOtp, checkpoint } from './signup.controller';

const router = Router();

router.post('/request-otp', validate(RequestOtpSchema), requestOtp);
router.post('/verify-otp', validate(VerifyOtpSchema), verifyOtp);

router.post('/checkpoint', validate(CheckpointSchema), checkpoint);

export default router;
