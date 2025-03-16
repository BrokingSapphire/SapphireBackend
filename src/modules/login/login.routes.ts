import { Router } from 'express';
import { RequestOtpSchema, VerifyOtpSchema } from './login.validator';
import { validate } from '@app/middlewares';
import { requestOtp, verifyOtp } from './login.controller';

/**
 * @swagger
 * tags:
 *   name: Login
 *   description: Login related endpoints
 */
const router = Router();

/**
 * @swagger
 * /request-otp:
 *   post:
 *     tags: [Login]
 *     summary: Request an OTP for login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestOtpSchema'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Email or phone number not found
 */
router.post('/request-otp', validate(RequestOtpSchema), requestOtp);

/**
 * @swagger
 * /verify-otp:
 *   post:
 *     tags: [Login]
 *     summary: Verify the OTP for login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpSchema'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 *       404:
 *         description: Email or phone number not found
 */
router.post('/verify-otp', validate(VerifyOtpSchema), verifyOtp);

export default router;
