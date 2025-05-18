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
} from './signup.types';
import { CredentialsType } from '@app/modules/common.types';
import { OTP_LENGTH } from './signup.services';
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

const VerifyOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.string().email().required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    otp: Joi.string().length(OTP_LENGTH).required(),
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
        is: CheckpointStep.ACCOUNT_DETAIL,
        then: Joi.string()
            .valid(...Object.values(AnnualIncome))
            .required(),
    }),
    experience: Joi.alternatives().conditional('step', {
        is: CheckpointStep.ACCOUNT_DETAIL,
        then: Joi.string()
            .valid(...Object.values(TradingExperience))
            .required(),
    }),
    settlement: Joi.alternatives().conditional('step', {
        is: CheckpointStep.ACCOUNT_DETAIL,
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
    bank: Joi.alternatives().conditional('step', {
        is: CheckpointStep.BANK_VALIDATION,
        then: Joi.alternatives().conditional('validation_type', {
            is: ValidationType.BANK,
            then: Joi.object({
                account_number: Joi.string().required(),
                ifsc_code: Joi.string().required(),
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
});

export { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema };
