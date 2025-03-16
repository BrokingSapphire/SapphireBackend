import { Response } from 'express';
import { Request } from 'express-jwt';
import { CredentialsType } from '@app/modules/common.types';
import { db } from '@app/database';
import { NotFoundError } from '@app/apiError';
import { EmailOtpVerification, PhoneOtpVerification } from '@app/modules/signup/signup.services';
import { OK } from '@app/utils/httpstatus';

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

        const phoneOtp = new PhoneOtpVerification(phone);
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
        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.verifyOtp(otp);
    }

    res.status(OK).json({ message: 'OTP verified' });
};

export { requestOtp, verifyOtp };
