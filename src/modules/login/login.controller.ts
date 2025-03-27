import { Response } from 'express';
import { Request } from 'express-jwt';
import { CredentialsType } from '@app/modules/common.types';
import { db } from '@app/database';
import { NotFoundError } from '@app/apiError';
import { EmailOtpVerification, PhoneOtpVerification } from '@app/modules/signup/signup.services';
import { OK } from '@app/utils/httpstatus';
import { sign } from '@app/utils/jwt';
import { NotNull } from 'kysely';

const requestOtp = async (req: Request, res: Response) => {
    const { type, phone, email } = req.body;

    if (type === CredentialsType.EMAIL) {
        const response = await db
            .selectFrom('signup_checkpoints')
            .select('email')
            .where('email', '=', email)
            .executeTakeFirst();

        if (!response) {
            throw new NotFoundError('Email not found');
        }

        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.sendOtp();
    } else {
        const response = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
            .select('signup_checkpoints.email')
            .where('phone_number.phone', '=', phone)
            .executeTakeFirst();

        if (!response) {
            throw new NotFoundError('Phone number not found');
        }

        const phoneOtp = new PhoneOtpVerification(email, phone);
        await phoneOtp.sendOtp();
    }

    res.status(OK).json({ message: 'OTP sent' });
};

const verifyOtp = async (req: Request, res: Response) => {
    const { type, phone, email, otp } = req.body;

    if (type === CredentialsType.EMAIL) {
        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.verifyOtp(otp);
    } else {
        const phoneOtp = new PhoneOtpVerification(email, phone);
        await phoneOtp.verifyOtp(otp);
    }

    let query = db
        .selectFrom('signup_checkpoints')
        .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
        .select(['signup_checkpoints.email', 'phone_number.phone']);
    if (email) {
        query = query.where('signup_checkpoints.email', '=', email);
    } else {
        query = query.where('phone_number.phone', '=', phone);
    }

    const { email: e, phone: p } = await query
        .$narrowType<{ email: NotNull; phone: NotNull }>()
        .executeTakeFirstOrThrow();

    const token = sign({
        e,
        p,
    });
    res.status(OK).json({ message: 'OTP verified', token });
};

export { requestOtp, verifyOtp };
