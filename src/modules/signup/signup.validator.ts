import Joi from 'joi';
import { CheckpointStep } from './signup.types';

const RequestOtpSchema = Joi.object({
    type: Joi.string().valid('email', 'phone').required(),
    phone: Joi.alternatives().conditional('type', {
        is: 'phone',
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
    }),
    email: Joi.alternatives().conditional('type', {
        is: 'email',
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
    }),
});

const VerifyOtpSchema = Joi.object({
    type: Joi.string().valid('email', 'phone').required(),
    email: Joi.string().required(),
    phone: Joi.alternatives().conditional('type', {
        is: 'phone',
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
    }),
    otp: Joi.string().required(),
});

const CheckpointSchema = Joi.object({
    step: Joi.string().valid(Object.values(CheckpointStep)).required(),
    email: Joi.alternatives().conditional('step', { is: CheckpointStep.CREDENTIALS, then: Joi.string().required() }),
    phone: Joi.alternatives().conditional('step', { is: CheckpointStep.CREDENTIALS, then: Joi.string().required() }),
});

export { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema };
