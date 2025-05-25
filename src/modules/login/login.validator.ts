import Joi from 'joi';
import { OTP_LENGTH } from '@app/modules/signup/signup.services';

const EmailOrClientIdSchema = Joi.object({
    clientId: Joi.string().when('email', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required(),
    }),
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
        .length(OTP_LENGTH)
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
    recaptchaToken: Joi.string().required(),
});

export const ForgotPasswordVerifyOtpSchema = Joi.object({
    requestId: Joi.string().required(),
    emailOtp: Joi.string()
        .required()
        .length(6)
        .pattern(/^[0-9]{6}$/),
    phoneOtp: Joi.string()
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
});
