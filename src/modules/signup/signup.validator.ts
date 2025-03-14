import Joi from 'joi';
import {
    CredentialsType,
    CheckpointStep,
    InvestmentSegment,
    MaritalStatus,
    AnnualIncome,
    TradingExperience,
    AccountSettlement,
    ValidationType,
} from './signup.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[1-9]\d{9}$/;

const RequestOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    email: Joi.string().regex(EMAIL_REGEX).required(),
});

const VerifyOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.string().regex(EMAIL_REGEX).required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    otp: Joi.string().required(),
});

const CheckpointSchema = Joi.object({
    step: Joi.string()
        .valid(...Object.values(CheckpointStep))
        .required(),
    email: Joi.alternatives().conditional('step', {
        is: CheckpointStep.CREDENTIALS,
        then: Joi.string().regex(EMAIL_REGEX).required(),
    }),
    phone: Joi.alternatives().conditional('step', {
        is: CheckpointStep.CREDENTIALS,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    pan_number: Joi.alternatives().conditional('step', { is: CheckpointStep.PAN, then: Joi.string().required() }),
    dob: Joi.alternatives().conditional('step', { is: CheckpointStep.PAN, then: Joi.date().required() }),
    redirect: Joi.string().optional(),
    segments: Joi.alternatives().conditional('step', {
        is: CheckpointStep.INVESTMENT_SEGMENT,
        then: Joi.array()
            .items(Joi.string().valid(...Object.values(InvestmentSegment)))
            .required(),
    }),
    marital_status: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(MaritalStatus))
            .required(),
    }),
    father_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
    }),
    mother_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
    }),
    annual_income: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AnnualIncome))
            .required(),
    }),
    experience: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(TradingExperience))
            .required(),
    }),
    settlement: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AccountSettlement))
            .required(),
    }),
    occupation: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OCCUPATION,
        then: Joi.string().required(),
    }),
    politically_exposed: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OCCUPATION,
        then: Joi.boolean().required(),
    }),
    validation_type: Joi.alternatives()
        .conditional('step', {
            is: CheckpointStep.BANK_VALIDATION,
            then: Joi.string()
                .valid(...Object.values(ValidationType))
                .required(),
        })
        .conditional('step', {
            is: CheckpointStep.BANK_VALIDATION_START,
            then: Joi.string()
                .valid(...Object.values(ValidationType))
                .required(),
        }),
    bank: Joi.alternatives().conditional(
        Joi.object({ step: CheckpointStep.BANK_VALIDATION, validation_type: ValidationType.BANK }),
        {
            then: Joi.object({
                account_number: Joi.string().required(),
                ifsc_code: Joi.string().required(),
            }).required(),
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
    }),
});

export { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema };
