import Joi from 'joi';

export const LoginSchema = Joi.object({
    clientId: Joi.string().required(),
    password: Joi.string().required(),
});

export const LoginOtpVerifySchema = Joi.object({
    requestId: Joi.string().required().uuid(),
    otp: Joi.string().required().length(6).pattern(/^[0-9]{6}$/),
});

export const ResetPasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
            'string.min': 'Password must be at least 8 characters long',
        }),
});

export const ForgotPasswordInitiateSchema = Joi.object({
    panNumber: Joi.string().required().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
    recaptchaToken: Joi.string().required(),
});

export const ForgotPasswordVerifyOtpSchema = Joi.object({
    requestId: Joi.string().required(),
    emailOtp: Joi.string().required().length(6).pattern(/^[0-9]{6}$/),
    phoneOtp: Joi.string().required().length(6).pattern(/^[0-9]{6}$/),
});

export const ForgotPasswordResetSchema = Joi.object({
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
        'string.min': 'Password must be at least 8 characters long',
    }),
});