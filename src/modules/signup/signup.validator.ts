import Joi from 'joi';
import {
    AccountSettlement,
    AnnualIncome,
    CheckpointStep,
    CredentialsType,
    InvestmentSegment,
    MaritalStatus,
    TradingExperience,
    ValidationType,
} from './signup.types';
import { OTP_LENGTH } from './signup.services';

const PHONE_REGEX: RegExp = /^[1-9]\d{9}$/;
const PAN_REGEX: RegExp = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const RequestOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
        otherwise: Joi.forbidden(),
    }),
    email: Joi.string().email().required(),
});

const VerifyOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.string().email().required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
        otherwise: Joi.forbidden(),
    }),
    otp: Joi.string().length(OTP_LENGTH).required(),
});

const CheckpointSchema = Joi.object({
    step: Joi.string()
        .valid(...Object.values(CheckpointStep))
        .required(),
    email: Joi.alternatives().conditional('step', {
        is: CheckpointStep.CREDENTIALS,
        then: Joi.string().email().required(),
        otherwise: Joi.forbidden(),
    }),
    phone: Joi.alternatives().conditional('step', {
        is: CheckpointStep.CREDENTIALS,
        then: Joi.string().regex(PHONE_REGEX).required(),
        otherwise: Joi.forbidden(),
    }),
    pan_number: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PAN,
        then: Joi.string().length(10).regex(PAN_REGEX).required(),
        otherwise: Joi.forbidden(),
    }),
    redirect: Joi.string().optional(),
    segments: Joi.alternatives().conditional('step', {
        is: CheckpointStep.INVESTMENT_SEGMENT,
        then: Joi.array()
            .items(Joi.string().valid(...Object.values(InvestmentSegment)))
            .required(),
        otherwise: Joi.forbidden(),
    }),
    marital_status: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(MaritalStatus))
            .required(),
        otherwise: Joi.forbidden(),
    }),
    father_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
        otherwise: Joi.forbidden(),
    }),
    mother_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
        otherwise: Joi.forbidden(),
    }),
    annual_income: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AnnualIncome))
            .required(),
        otherwise: Joi.forbidden(),
    }),
    experience: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(TradingExperience))
            .required(),
        otherwise: Joi.forbidden(),
    }),
    settlement: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AccountSettlement))
            .required(),
        otherwise: Joi.forbidden(),
    }),
    occupation: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OCCUPATION,
        then: Joi.string().required(),
        otherwise: Joi.forbidden(),
    }),
    politically_exposed: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OCCUPATION,
        then: Joi.boolean().required(),
        otherwise: Joi.forbidden(),
    }),
    validation_type: Joi.alternatives()
        .conditional('step', {
            is: CheckpointStep.BANK_VALIDATION,
            then: Joi.string()
                .valid(...Object.values(ValidationType))
                .required(),
            otherwise: Joi.forbidden(),
        })
        .conditional('step', {
            is: CheckpointStep.BANK_VALIDATION_START,
            then: Joi.string()
                .valid(...Object.values(ValidationType))
                .required(),
            otherwise: Joi.forbidden(),
        }),
    bank: Joi.alternatives().conditional(
        Joi.object({ step: CheckpointStep.BANK_VALIDATION, validation_type: ValidationType.BANK }),
        {
            then: Joi.object({
                account_number: Joi.string().required(),
                ifsc_code: Joi.string().required(),
            }).required(),
            otherwise: Joi.forbidden(),
        },
    ),
    nominees: Joi.alternatives().conditional('step', {
        is: CheckpointStep.ADD_NOMINEES,
        then: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                gov_id: Joi.date().required(),
                relation: Joi.string().required(),
                share: Joi.number().required(),
            }),
        ),
        otherwise: Joi.forbidden(),
    }),
});

export { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema };
