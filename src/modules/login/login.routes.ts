import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    ResetPasswordSchema,
    LoginRequestSchema,
    ForgotPasswordInitiateSchema,
    ForgotOTPVerifySchema,
    ForgotPasswordResetSchema,
    ResendLoginOtpSchema,
    ResendForgotPasswordOtpSchema,
    Verify2FASchema,
    ForgotMpinResetSchema,
    ResendForgotMpinOtpSchema,
    ForgotMpinOtpVerifySchema,
    ForgotMpinInitiateSchema,
    MpinVerifySchema,
} from './login.validator';
import {
    login,
    resetPassword,
    forgotPasswordInitiate,
    forgotOTPverify,
    forgotPasswordReset,
    resendForgotPasswordOtp,
    verify2FA,
    Resend2FALoginOtp,
    verifyMpin,
    forgotMpinInitiate,
    forgotMpinOtpVerify,
    resendForgotMpinOtp,
    forgotMpinReset,
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
 * /login/verify-2fa:
 *   post:
 *     tags: [Login]
 *     summary: Verify 2FA code during login
 *     description: Verify the 2FA code (SMS OTP or Authenticator) during login process
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - token
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *                 description: Login session ID from login response
 *               token:
 *                 type: string
 *                 example: '123456'
 *                 description: 6-digit SMS OTP or 6-digit authenticator code
 *     responses:
 *       200:
 *         description: 2FA code verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2FA verified. Please enter your MPIN.
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     nextStep:
 *                       type: string
 *                       example: mpin
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid or expired 2FA code
 */
router.post('/verify-2fa', validate(Verify2FASchema), verify2FA);

/**
 * @swagger
 * /login/2fa/send-otp:
 *   post:
 *     tags: [Login]
 *     summary: Send 2FA SMS OTP during login
 *     description: Send or resend SMS OTP for 2FA verification during login (only for SMS_OTP method)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *                 description: Login session ID from login response
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent for 2FA verification
 *                 data:
 *                   type: object
 *                   properties:
 *                     maskedPhone:
 *                       type: string
 *                       example: '+91 98******90'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Session expired, password verification required, or SMS OTP not enabled
 */
router.post('/2fa/resend-otp', validate(ResendLoginOtpSchema), Resend2FALoginOtp);

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
 * /login/forgot-password/resend-otp:
 *   post:
 *     tags: [Login]
 *     summary: Resend OTP for forgot password
 *     description: Resend the OTP to email during forgot password process
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *             properties:
 *               requestId:
 *                 type: string
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *                 description: Request ID from initiate step
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP resent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     maskedEmail:
 *                       type: string
 *                       example: ab***@example.com
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Session expired or already used
 */
router.post('/forgot-password/resend-otp', validate(ResendForgotPasswordOtpSchema), resendForgotPasswordOtp);

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

/**
 * @swagger
 * /login/verify-mpin:
 *   post:
 *     tags: [Login]
 *     summary: Verify MPIN during login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MpinVerifySchema'
 *     responses:
 *       200:
 *         description: MPIN verified successfully
 *       401:
 *         description: Invalid MPIN or session
 */
router.post('/verify-mpin', validate(MpinVerifySchema), verifyMpin);

/**
 * @swagger
 * /login/forgot-mpin/initiate:
 *   post:
 *     tags: [Login]
 *     summary: Initiate forgot MPIN process
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotMpinInitiateSchema'
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       404:
 *         description: User not found
 */
router.post('/forgot-mpin/initiate', validate(ForgotMpinInitiateSchema), forgotMpinInitiate);

/**
 * @swagger
 * /login/forgot-mpin/verify-otp:
 *   post:
 *     tags: [Login]
 *     summary: Verify OTP for forgot MPIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotMpinOtpVerifySchema'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/forgot-mpin/verify-otp', validate(ForgotMpinOtpVerifySchema), forgotMpinOtpVerify);

/**
 * @swagger
 * /login/forgot-mpin/resend-otp:
 *   post:
 *     tags: [Login]
 *     summary: Resend OTP for forgot MPIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendForgotMpinOtpSchema'
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       401:
 *         description: Session expired or invalid
 */
router.post('/forgot-mpin/resend-otp', validate(ResendForgotMpinOtpSchema), resendForgotMpinOtp);

/**
 * @swagger
 * /login/forgot-mpin/reset:
 *   post:
 *     tags: [Login]
 *     summary: Reset MPIN after OTP verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotMpinResetSchema'
 *     responses:
 *       200:
 *         description: MPIN reset successful
 *       401:
 *         description: OTP not verified or session expired
 */
router.post('/forgot-mpin/reset', validate(ForgotMpinResetSchema), forgotMpinReset);

export default router;
