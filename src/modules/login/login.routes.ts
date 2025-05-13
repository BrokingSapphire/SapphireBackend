import { Router } from 'express';
import { validate } from '@app/middlewares';
import { 
    LoginSchema, 
    ResetPasswordSchema,
    ForgotPasswordInitiateSchema,
    ForgotPasswordVerifyOtpSchema,
    ForgotPasswordResetSchema
} from './login.validator';
import {
    login,
    resetPassword,
    initiatePasswordReset,
    verifyPasswordResetOtp,
    completePasswordReset
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
router.post('/login', validate(LoginSchema), login);

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
router.post('/forgot-password/reset', validate(ForgotPasswordResetSchema), completePasswordReset);

export default router;