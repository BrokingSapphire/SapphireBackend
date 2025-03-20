import { Router } from 'express';
import { CheckpointSchema, PaymentVerifySchema, RequestOtpSchema, VerifyOtpSchema } from './signup.validator';
import { validate } from '@app/middlewares';
import {
    getCheckpoint,
    getIpv,
    initiatePayment,
    postCheckpoint,
    putIpv,
    requestOtp,
    verify,
    verifyOtp,
    verifyPayment,
} from './signup.controller';
import { jwtMiddleware } from '@app/utils/jwt';

/**
 * @swagger
 * tags:
 *   name: Signup
 *   description: Signup related endpoints
 */
const router = Router();

/**
 * @swagger
 * /request-otp:
 *   post:
 *     tags: [Signup]
 *     summary: Request an OTP for signup
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
 *     tags: [Signup]
 *     summary: Verify the OTP for signup
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

router.post('/verify', jwtMiddleware, verify);

router.post('payment/initiate', jwtMiddleware, initiatePayment);

router.post('payment/verify', [jwtMiddleware, validate(PaymentVerifySchema)], verifyPayment);

router.get('/checkpoint/:step', jwtMiddleware, getCheckpoint);

/**
 * @swagger
 * /checkpoint:
 *   post:
 *     tags: [Signup]
 *     summary: Update checkpoint information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckpointSchema'
 *     responses:
 *       200:
 *         description: Checkpoint updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/checkpoint', [jwtMiddleware, validate(CheckpointSchema)], postCheckpoint);

/**
 * @swagger
 * /ipv/{uid}:
 *   put:
 *     tags: [Signup]
 *     summary: Update IPV information
 *     parameters:
 *       - name: uid
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IPV updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/ipv/:uid', jwtMiddleware, putIpv);

/**
 * @swagger
 * /ipv:
 *   get:
 *     tags: [Signup]
 *     summary: Get IPV information
 *     responses:
 *       200:
 *         description: IPV information retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/ipv', jwtMiddleware, getIpv);

export default router;
