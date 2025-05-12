import Joi from 'joi';

export const LoginSchema = Joi.object({
    clientId: Joi.string().required(),
    password: Joi.string().required(),
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