import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    LoginSchema,
    LoginOtpVerifySchema,
    ResetPasswordSchema,
    ForgotPasswordInitiateSchema,
    ForgotPasswordVerifyOtpSchema,
    ForgotPasswordResetSchema,
} from './login.validator';
import {
    login,
    verifyLoginOtp,
    resetPassword,
    initiatePasswordReset,
    verifyPasswordResetOtp,
    completePasswordReset,
} from './login.controller';
import { jwtMiddleware } from '@app/utils/jwt';

/**
 * @swagger
 * tags:
 *   name: Login
 *   description: Login and authentication related endpoints
 */
const router = Router();

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Login]
 *     summary: Login with client ID and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginSchema'
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
router.post('/', validate(LoginSchema), login);

/**
 * @swagger
 * /login/verify-otp:
 *   post:
 *     tags: [Login]
 *     summary: Verify OTP for login authentication
 *     description: Verifies the OTP sent during login for non-first-time users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginOtpVerifySchema'
 *     responses:
 *       200:
 *         description: OTP verification successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 isFirstLogin:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', validate(LoginOtpVerifySchema), verifyLoginOtp);

/**
 * @swagger
 * /login/reset-password:
 *   post:
 *     tags: [Login]
 *     summary: Reset password (requires authentication)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordSchema'
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized or incorrect current password
 */
router.post('/reset-password', [jwtMiddleware, validate(ResetPasswordSchema)], resetPassword);

/**
 * @swagger
 * /login/forgot-password/initiate:
 *   post:
 *     tags: [Login]
 *     summary: Initiate password reset process by sending OTPs to email and phone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInitiateSchema'
 *     responses:
 *       200:
 *         description: OTPs sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 */
router.post('/forgot-password/initiate', validate(ForgotPasswordInitiateSchema), initiatePasswordReset);

/**
 * @swagger
 * /login/forgot-password/verify-otp:
 *   post:
 *     tags: [Login]
 *     summary: Verify OTPs sent to email and phone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordVerifyOtpSchema'
 *     responses:
 *       200:
 *         description: OTPs verified successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid OTPs
 */
router.post('/forgot-password/verify-otp', validate(ForgotPasswordVerifyOtpSchema), verifyPasswordResetOtp);

/**
 * @swagger
 * /login/forgot-password/reset:
 *   post:
 *     tags: [Login]
 *     summary: Complete password reset after OTP verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordResetSchema'
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized or OTP verification incomplete
 */
router.post('/forgot-password/reset', [jwtMiddleware, validate(ForgotPasswordResetSchema)], completePasswordReset);

export default router;
