import Joi from 'joi';
import {
    AccountSettlement,
    AnnualIncome,
    CheckpointStep,
    InvestmentSegment,
    MaritalStatus,
    NomineeRelation,
    TradingExperience,
    ValidationType,
    Occupation,
} from './signup.types';
import { CredentialsType } from '@app/modules/common.types';
import { DEFAULT_OTP_LENGTH } from '@app/services/otp.service';
import { PHONE_REGEX } from '@app/services/sms.service';
import { PAN_REGEX } from '@app/services/surepass/pan.service';
import { AADHAAR_REGEX } from '@app/utils/aadhaar-xml.parser';

const RequestOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    email: Joi.string().email().required(),
});

const ResendOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.string().email().required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
});

const VerifyOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.string().email().required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    otp: Joi.string().length(DEFAULT_OTP_LENGTH).required(),
});

const CheckpointSchema = Joi.object({
    step: Joi.string()
        .valid(...Object.values(CheckpointStep))
        .required(),
    pan_number: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PAN,
        then: Joi.string().length(10).regex(PAN_REGEX).required(),
    }),
    redirect: Joi.alternatives().conditional('step', {
        is: CheckpointStep.AADHAAR_URI,
        then: Joi.string().required(),
    }),
    full_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.AADHAAR_MISMATCH_DETAILS,
        then: Joi.string().required(),
    }),
    dob: Joi.alternatives().conditional('step', {
        is: CheckpointStep.AADHAAR_MISMATCH_DETAILS,
        then: Joi.date().iso().required(),
    }),
    segments: Joi.alternatives().conditional('step', {
        is: CheckpointStep.INVESTMENT_SEGMENT,
        then: Joi.array()
            .items(Joi.string().valid(...Object.values(InvestmentSegment)))
            .required(),
    }),
    father_spouse_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
    }),
    mother_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().required(),
    }),
    maiden_name: Joi.alternatives().conditional('step', {
        is: CheckpointStep.USER_DETAIL,
        then: Joi.string().optional().allow(null, ''),
    }),
    marital_status: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PERSONAL_DETAIL,
        then: Joi.string()
            .valid(...Object.values(MaritalStatus))
            .required(),
    }),
    annual_income: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PERSONAL_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AnnualIncome))
            .required(),
    }),
    trading_exp: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PERSONAL_DETAIL,
        then: Joi.string()
            .valid(...Object.values(TradingExperience))
            .required(),
    }),
    acc_settlement: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PERSONAL_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AccountSettlement))
            .required(),
    }),
    occupation: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OTHER_DETAIL,
        then: Joi.string()
            .valid(...Object.values(Occupation))
            .required(),
    }),
    politically_exposed: Joi.alternatives().conditional('step', {
        is: CheckpointStep.OTHER_DETAIL,
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
    bank: Joi.alternatives().conditional('step', {
        is: CheckpointStep.BANK_VALIDATION,
        then: Joi.alternatives().conditional('validation_type', {
            is: ValidationType.BANK,
            then: Joi.object({
                account_number: Joi.string().required(),
                ifsc_code: Joi.string().required(),
                account_type: Joi.string().required(),
            }).required(),
        }),
    }),
    nominees: Joi.alternatives().conditional('step', {
        is: CheckpointStep.ADD_NOMINEES,
        then: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                gov_id: Joi.string()
                    .min(10)
                    .max(12)
                    .regex(new RegExp(PAN_REGEX.source + '|' + AADHAAR_REGEX.source))
                    .required(),
                relation: Joi.string()
                    .valid(...Object.values(NomineeRelation))
                    .required(),
                share: Joi.number().min(0).max(100).required(),
            }),
        ),
    }),

    password: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PASSWORD_SETUP,
        then: Joi.string().min(8).max(64).required().messages({
            'string.min': 'Password must be at least 8 characters',
            'string.max': 'Password must not exceed 64 characters',
            'any.required': 'Password is required',
        }),
    }),
    confirm_password: Joi.alternatives().conditional('step', {
        is: CheckpointStep.PASSWORD_SETUP,
        then: Joi.string().valid(Joi.ref('password')).required().messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Confirm password is required',
        }),
    }),
});

const SetupMpinSchema = Joi.object({
    mpin: Joi.string()
        .pattern(/^[0-9]{4}$/)
        .required()
        .messages({
            'string.pattern.base': 'MPIN must be 4 digits',
            'any.required': 'MPIN is required',
        }),
    confirm_mpin: Joi.string().valid(Joi.ref('mpin')).required().messages({
        'any.only': 'MPINs do not match',
        'any.required': 'Confirm MPIN is required',
    }),
});

export { RequestOtpSchema, ResendOtpSchema, VerifyOtpSchema, CheckpointSchema, SetupMpinSchema };
