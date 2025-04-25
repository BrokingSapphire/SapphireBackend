// src/validators/compliance.validator.ts
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { VerificationType, VerificationStatus } from './compliance.types';

/**
 * Validation schema for verification status update
 */
const updateVerificationStatusSchema = Joi.object({
    verificationType: Joi.string()
        .valid(
            'pan',
            'aadhaar',
            'bank',
            'address',
            'signature',
            'ipv',
            'front_office',
            'trading_preferences',
            'nominee',
            'other_documents',
            'esign',
        )
        .required()
        .messages({
            'string.empty': 'Verification type is required',
            'any.required': 'Verification type is required',
            'any.only': 'Verification type must be one of the valid types',
        }),

    status: Joi.string().valid('pending', 'verified', 'rejected').required().messages({
        'string.empty': 'Status is required',
        'any.required': 'Status is required',
        'any.only': 'Status must be one of: pending, verified, or rejected',
    }),
});

/**
 * Validation schema for rendering verification detail
 */
const renderVerificationDetailSchema = Joi.object({
    step: Joi.string()
        .valid(
            'step1-pan',
            'step2-aadhar',
            'step3-bank',
            'step4-address',
            'step5-signature',
            'step6-ipv',
            'step7-fo',
            'step8-trading',
            'step9-nominee',
            'step10-other',
            'step11-esign',
        )
        .default('step1-pan')
        .messages({
            'any.only': 'Step must be one of the valid verification steps',
        }),
});

/**
 * Validation schema for checkpoint ID parameter
 */
const checkpointIdParamSchema = Joi.object({
    checkpointId: Joi.number().integer().positive().required().messages({
        'number.base': 'Checkpoint ID must be a number',
        'number.integer': 'Checkpoint ID must be an integer',
        'number.positive': 'Checkpoint ID must be positive',
        'any.required': 'Checkpoint ID is required',
    }),
});

/**
 * Middleware function for validating request body
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');

            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errorMessage,
            });
        }

        next();
    };
};

/**
 * Middleware function for validating request params
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.params, { abortEarly: false });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');

            return res.status(400).json({
                success: false,
                message: 'Validation error in parameters',
                errors: errorMessage,
            });
        }

        next();
    };
};


/**
 * Export validators for use in routes
 */
export const validators = {
    updateVerificationStatus: validateBody(updateVerificationStatusSchema),
    renderVerificationDetail: validateBody(renderVerificationDetailSchema),
    checkpointIdParam: validateParams(checkpointIdParamSchema),
};

export default validators;