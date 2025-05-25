import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    LoginOtpVerifySchema,
    ResetPasswordSchema,
    LoginRequestSchema,
    ForgotPasswordInitiateSchema,
    ForgotOTPVerifySchema,
    ForgotPasswordResetSchema,
} from './login.validator';
import {
    login,
    verifyLoginOtp,
    resetPassword,
    forgotPasswordInitiate,
    forgotOTPverify,
    forgotPasswordReset,
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
 *             $ref: '#/components/schemas/LoginRequestSchema'
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
router.post('/', validate(LoginRequestSchema), login);

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
 *     summary: Initiate forgot password process
 *     description: Start the forgot password process by providing PAN number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - panNumber
 *             properties:
 *               panNumber:
 *                 type: string
 *                 pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
 *                 example: ABCDE1234F
 *                 description: Valid PAN number
 *     responses:
 *       200:
 *         description: OTP sent to registered email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent to your registered email
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     maskedEmail:
 *                       type: string
 *                       example: ab***@example.com
 *       400:
 *         description: Invalid PAN number format
 *       404:
 *         description: No account found with this PAN number
 */
router.post('/forgot-password/initiate', validate(ForgotPasswordInitiateSchema), forgotPasswordInitiate);

/**
 * @swagger
 * /login/forgot-password/verify-otp:
 *   post:
 *     tags: [Login]
 *     summary: Verify OTP for forgot password
 *     description: Verify the OTP sent to email during forgot password process
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - otp
 *             properties:
 *               requestId:
 *                 type: string
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *                 description: Request ID from initiate step
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: '123456'
 *                 description: 6-digit OTP received in email
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully. You can now reset your password.
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *       400:
 *         description: Invalid OTP or already verified
 *       401:
 *         description: Session expired or invalid
 */
router.post('/forgot-password/verify-otp', validate(ForgotOTPVerifySchema), forgotOTPverify);

/**
 * @swagger
 * /login/forgot-password/reset:
 *   post:
 *     tags: [Login]
 *     summary: Reset password after OTP verification
 *     description: Set new password after successful OTP verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               requestId:
 *                 type: string
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *                 description: Request ID from previous steps
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'
 *                 example: NewPassword123!
 *                 description: New password with complexity requirements
 *               confirmPassword:
 *                 type: string
 *                 example: NewPassword123!
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successful. You can now login with your new password.
 *       400:
 *         description: Passwords don't match or invalid format
 *       401:
 *         description: OTP not verified or session expired
 */
router.post('/forgot-password/reset', validate(ForgotPasswordResetSchema), forgotPasswordReset);

export default router;
