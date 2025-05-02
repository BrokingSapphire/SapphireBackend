import Joi from 'joi';
import { VerificationType } from './compliance.types';

const GetVerificationDetailParamSchema = Joi.object({
    step: Joi.string()
        .valid(...Object.entries(VerificationType))
        .required(),
});

const UpdateVerificationStatusSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(VerificationType))
        .required(),
    status: Joi.string().valid('approve', 'reject').required(),
});

const CheckpointIdParamSchema = Joi.object({
    checkpointId: Joi.number().integer().positive().required(),
});

export { GetVerificationDetailParamSchema, UpdateVerificationStatusSchema, CheckpointIdParamSchema };
