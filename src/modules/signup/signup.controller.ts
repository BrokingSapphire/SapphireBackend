import { Request, Response } from 'express';
import redisClient from '@app/services/redis';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { CredentialsType, CheckpointStep } from './signup.types';

const requestOtp = async (req: Request, res: Response) => {
    const { type, phone, email } = req.body;
    if (type === CredentialsType.EMAIL) {
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
    } else if (type === CredentialsType.PHONE) {
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
    if (type === CredentialsType.EMAIL) {
        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.verifyOtp(otp);
        await redisClient.set(`email-verified:${email}`, 'true');
        await redisClient.expire(`email-verified:${email}`, 10 * 60);
    } else if (type === CredentialsType.PHONE) {
        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.verifyOtp(otp);
        await redisClient.del(`email-verified:${email}`);
    }

    res.status(200).json({ message: 'OTP verified' });
};

const checkpoint = async (req: Request, res: Response) => {
    const { step } = req.body;
    if (step === CheckpointStep.CREDENTIALS) {
        const { email, phone } = req.body;

        await db.transaction().execute(async (tx) => {
            const phoneId = await tx.insertInto('phone_number').values({ phone }).returning('id').executeTakeFirst();
            await tx.insertInto('signup_checkpoints').values({ email, phone_id: phoneId!!.id }).execute();
        });
        res.status(200).json({ message: 'Credentials saved' });
    } else if (step === CheckpointStep.PAN) {
        const { pan_number, dob } = req.body;

        // Call surepass api to verify pan and dob

        res.status(200).json({ message: 'PAN saved' });
    } else if (step === CheckpointStep.AADHAAR) {
        const { aadhaar_number } = req.body;

        // Call digilocker api to verify aadhaar

        res.status(200).json({ message: 'Aadhaar saved' });
    }
};

export { requestOtp, verifyOtp, checkpoint };
