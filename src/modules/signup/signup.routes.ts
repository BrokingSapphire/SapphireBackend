import { Router } from 'express';
import { CheckpointSchema, RequestOtpSchema, ResendOtpSchema, VerifyOtpSchema } from './signup.validator';
import { validate } from '@app/middlewares';
import {
    finalizeSignup,
    getCheckpoint,
    getIncomeProof,
    getIpv,
    getSignature,
    postCheckpoint,
    putIncomeProof,
    putIpv,
    putSignature,
    requestOtp,
    resendOtp,
    verifyOtp,
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
 * /resend-otp:
 *   post:
 *     tags: [Signup]
 *     summary: Resend OTP for signup
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpSchema'
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid request or too many attempts
 *       401:
 *         description: No active OTP session found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/resend-otp', validate(ResendOtpSchema), resendOtp);

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
router.post('/checkpoint', jwtMiddleware, validate(CheckpointSchema), postCheckpoint);

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

/**
 * @swagger
 * /signature/{uid}:
 *   put:
 *     tags: [Signup]
 *     summary: Update signature information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uid
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signature updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/signature/:uid', jwtMiddleware, putSignature);

/**
 * @swagger
 * /signature:
 *   get:
 *     tags: [Signup]
 *     summary: Get signature information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signature information retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Signature not found
 */
router.get('/signature', jwtMiddleware, getSignature);

/**
 * @swagger
 * /income-proof/{uid}:
 *   put:
 *     tags: [Signup]
 *     summary: Update income proof information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uid
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Income proof updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/income-proof/:uid', jwtMiddleware, putIncomeProof);

/**
 * @swagger
 * /income-proof:
 *   get:
 *     tags: [Signup]
 *     summary: Get income proof information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Income proof information retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Income proof not found
 */
router.get('/income-proof', jwtMiddleware, getIncomeProof);

/**
 * @swagger
 * /finalize:
 *   post:
 *     tags: [Signup]
 *     summary: Finalize the signup process
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signup finalized successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Signup process incomplete or invalid
 */
router.post('/finalize', jwtMiddleware, finalizeSignup);

/**
 * @swagger
 * /mpin:
 *   post:
 *     tags: [Signup]
 *     summary: Set MPIN for the user during signup
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *               - mpin
 *             properties:
 *               step:
 *                 type: string
 *                 enum: [MPIN]
 *                 description: Checkpoint step identifier
 *               mpin:
 *                 type: string
 *                 pattern: '^[0-9]{4}$'
 *                 description: 4 digit MPIN
 *             example:
 *               step: "MPIN"
 *               mpin: "1234"
 *     responses:
 *       201:
 *         description: MPIN set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "MPIN set successfully"
 *       400:
 *         description: Invalid request or MPIN already set
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Signup process incomplete
 */
router.post('/mpin', jwtMiddleware, validate(CheckpointSchema), postCheckpoint);

export default router;
