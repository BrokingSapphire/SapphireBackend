// signup.routes.ts

import { Router } from 'express';
import { CheckpointSchema, RequestOtpSchema, VerifyOtpSchema } from './signup.validator';
import { validate } from '@app/middlewares';
import { requestOtp, verifyOtp, checkpoint } from './signup.controller';
import { jwtMiddleware } from '@app/utils/jwt';

const router = Router();

router.post('/request-otp', validate(RequestOtpSchema), requestOtp);
router.post('/verify-otp', validate(VerifyOtpSchema), verifyOtp);

router.post('/checkpoint', [jwtMiddleware, validate(CheckpointSchema)], checkpoint);

export default router;
