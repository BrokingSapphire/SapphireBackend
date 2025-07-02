import { Router } from 'express';
import {
    CheckpointSchema,
    RequestOtpSchema,
    ResendOtpSchema,
    VerifyOtpSchema,
    SetupMpinSchema,
    SetupPasswordSchema,
    ValidateIfscSchema,
} from './signup.validator';
import { validate } from '@app/middlewares';
import {
    finalizeSignup,
    getCheckpoint,
    getIncomeProof,
    getIpv,
    getPanVerificationRecord,
    getSignature,
    postCheckpoint,
    putIncomeProof,
    putIpv,
    putPanVerificationRecord,
    putSignature,
    requestOtp,
    resendOtp,
    verifyOtp,
    setupMpin,
    setupPassword,
    validateIfsc,
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

/**
 * @swagger
 * /validate-ifsc:
 *   post:
 *     tags: [Signup]
 *     summary: Validate IFSC code and get bank details
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ifsc_code:
 *                 type: string
 *                 description: IFSC code to validate
 *                 example: "ICIC0000001"
 *             required:
 *               - ifsc_code
 *     responses:
 *       200:
 *         description: IFSC code validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     ifsc_code:
 *                       type: string
 *                     bank_details:
 *                       type: object
 *                       properties:
 *                         bank_name:
 *                           type: string
 *                         branch_name:
 *                           type: string
 *                         city:
 *                           type: string
 *                         district:
 *                           type: string
 *                         state:
 *                           type: string
 *       400:
 *         description: IFSC code is required
 *       422:
 *         description: Invalid IFSC code or IFSC does not support NEFT/RTGS
 *       401:
 *         description: Unauthorized
 */
router.post('/validate-ifsc', jwtMiddleware, validate(ValidateIfscSchema), validateIfsc);

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
 * /setup-password:
 *   post:
 *     tags: [Signup]
 *     summary: Setup password after signup finalization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetupPasswordSchema'
 *     responses:
 *       201:
 *         description: Password set successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid password or passwords do not match
 *       403:
 *         description: Please complete signup process first
 */
router.post('/setup-password', jwtMiddleware, validate(SetupPasswordSchema), setupPassword);

/**
 * @swagger
 * /setup-mpin:
 *   post:
 *     tags: [Signup]
 *     summary: Setup MPIN after signup finalization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetupMpinSchema'
 *     responses:
 *       201:
 *         description: MPIN set successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid MPIN or MPINs do not match
 *       403:
 *         description: Please complete signup process first
 */
router.post('/setup-mpin', jwtMiddleware, validate(SetupMpinSchema), setupMpin);

/**
 * @swagger
 * /pan-verification-record/{uid}:
 *   put:
 *     tags: [Signup]
 *     summary: Upload PAN verification record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uid
 *         in: path
 *         required: true
 *         description: Upload session ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PAN verification record PDF file
 *     responses:
 *       201:
 *         description: PAN verification record uploaded successfully
 *       401:
 *         description: Unauthorized or upload session expired
 *       422:
 *         description: Invalid file or upload error
 */
router.put('/pan-verification-record/:uid', jwtMiddleware, putPanVerificationRecord);

/**
 * @swagger
 * /pan-verification-record:
 *   get:
 *     tags: [Signup]
 *     summary: Get PAN verification record information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PAN verification record information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: URL of the uploaded PAN verification record
 *                 message:
 *                   type: string
 *       204:
 *         description: PAN verification record not uploaded
 *       401:
 *         description: Unauthorized
 */
router.get('/pan-verification-record', jwtMiddleware, getPanVerificationRecord);

export default router;
