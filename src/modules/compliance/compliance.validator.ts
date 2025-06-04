import Joi from 'joi';
import { VerificationType } from './compliance.types';

const GetVerificationDetailParamSchema = Joi.object({
    step: Joi.string()
        .valid(...Object.values(VerificationType))
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

const AddDematAccountSchema = Joi.object({
    depository: Joi.string().valid('CDSL', 'NSDL').required(),
    dp_name: Joi.string().min(1).max(100).required(),
    dp_id: Joi.string().min(1).max(20).required(),
    bo_id: Joi.string().min(1).max(20).required(),
    client_name: Joi.string().min(1).max(100).required(),
});

export {
    GetVerificationDetailParamSchema,
    AddDematAccountSchema,
    UpdateVerificationStatusSchema,
    CheckpointIdParamSchema,
};
