import { Request, Response } from 'express';
import redisClient from '@app/services/redis';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';

const requestOtp = async (req: Request, res: Response) => {
    const { type, phone, email } = req.body;
    if (type === 'email') {
        const userExists = await db.selectFrom('user').where('email', '=', email).executeTakeFirst();
        if (userExists) {
            throw new BadRequestError('Email already exists');
        }
        const checkpointExists = await db
            .selectFrom('signup_checkpoints')
            .where('email', '=', email)
            .executeTakeFirst();
        if (checkpointExists) {
            throw new BadRequestError('Email already exists');
        }

        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.sendOtp();
    } else if (type === 'phone') {
        const phoneExists = await db.selectFrom('phone_number').where('phone', '=', phone).executeTakeFirst();
        if (phoneExists) {
            throw new BadRequestError('Phone number already exists');
        }

        if (!(await redisClient.get(`email-verified:${email}`))) {
            throw new UnauthorizedError('Email not verified');
        }

        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.sendOtp();
    }

    res.status(200).json({ message: 'OTP sent' });
};

const verifyOtp = async (req: Request, res: Response) => {
    const { type, phone, email, otp } = req.body;
    if (type === 'email') {
        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.verifyOtp(otp);
        await redisClient.set(`email-verified:${email}`, 'true');
        await redisClient.expire(`email-verified:${email}`, 10 * 60);
    } else if (type === 'phone') {
        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.verifyOtp(otp);
        await redisClient.del(`email-verified:${email}`);
    }
    res.status(200).json({ message: 'OTP verified' });
};

const checkpoint = async (req: Request, res: Response) => {
    const { step } = req.body;
    if (step === 'credentials') {
        const { email, phone } = req.body;

        const phoneId = await db.insertInto('phone_number').values({ phone }).returning('id').executeTakeFirst();

        await db.insertInto('signup_checkpoints').values({ email, phone_id: phoneId!!.id }).execute();
        res.status(200).json({ message: 'Credentials saved' });
    }
};

export { requestOtp, verifyOtp, checkpoint };
