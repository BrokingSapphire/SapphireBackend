import Joi from 'joi';
import { CredentialsType } from '@app/modules/common.types';
import { OTP_LENGTH } from '@app/modules/signup/signup.services';
import { PHONE_REGEX } from '@app/services/sms.service';

const RequestOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    email: Joi.alternatives().conditional('type', {
        is: CredentialsType.EMAIL,
        then: Joi.string().email().required(),
    }),
});

const VerifyOtpSchema = Joi.object({
    type: Joi.string()
        .valid(...Object.values(CredentialsType))
        .required(),
    email: Joi.alternatives().conditional('type', {
        is: CredentialsType.EMAIL,
        then: Joi.string().email().required(),
    }),
    phone: Joi.alternatives().conditional('type', {
        is: CredentialsType.PHONE,
        then: Joi.string().regex(PHONE_REGEX).required(),
    }),
    otp: Joi.string().length(OTP_LENGTH).required(),
});

export { RequestOtpSchema, VerifyOtpSchema };
