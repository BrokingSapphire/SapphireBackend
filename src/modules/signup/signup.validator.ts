import Joi from 'joi';
import { CredentialsType, CheckpointStep } from './signup.types';

const RequestOtpSchema = Joi.object({
    type: Joi.string().valid(Object.values(CredentialsType)).required(),
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
    type: Joi.string().valid(Object.values(CredentialsType)).required(),
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
    pan_number: Joi.alternatives().conditional('step', { is: CheckpointStep.PAN, then: Joi.string().required() }),
    dob: Joi.alternatives().conditional('step', { is: CheckpointStep.PAN, then: Joi.string().required() }),
    investment_segments: Joi.alternatives().conditional('step', {
        is: CheckpointStep.INVESTMENT_SEGMENT,
        then: Joi.array().items(Joi.string()),
    }),
});

export { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema };
