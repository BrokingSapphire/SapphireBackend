import Joi from 'joi';
import { DEFAULT_OTP_LENGTH } from '@app/services/otp.service';

const EmailOrClientIdSchema = Joi.object({
    clientId: Joi.string().optional(),
    email: Joi.string().email().when('clientId', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required(),
    }),
});

export const LoginRequestSchema = EmailOrClientIdSchema.keys({
    password: Joi.string().required(),
});

export const LoginOtpVerifySchema = EmailOrClientIdSchema.keys({
    otp: Joi.string()
        .length(DEFAULT_OTP_LENGTH)
        .pattern(/^[0-9]{6}$/)
        .required(),
});

export const ResetPasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.pattern.base':
                'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
            'string.min': 'Password must be at least 8 characters long',
        }),
});

export const ForgotPasswordInitiateSchema = Joi.object({
    panNumber: Joi.string()
        .required()
        .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
});

export const ForgotOTPVerifySchema = Joi.object({
    requestId: Joi.string().required(),
    emailOtp: Joi.string()
        .required()
        .length(6)
        .pattern(/^[0-9]{6}$/),
});

export const ForgotPasswordResetSchema = Joi.object({
    newPassword: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.pattern.base':
                'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
            'string.min': 'Password must be at least 8 characters long',
        }),

    confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
        'any.only': 'Confirm password must match new password',
    }),
});
