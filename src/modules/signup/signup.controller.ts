import { Response } from 'express';
import { Request } from 'express-jwt';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { CredentialsType, CheckpointStep } from './signup.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import { sign } from '@app/utils/jwt';

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

        res.status(200).json({ message: 'OTP verified' });
    } else if (type === CredentialsType.PHONE) {
        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.verifyOtp(otp);
        await redisClient.del(`email-verified:${email}`);

        const token = sign({
            email,
            phone,
        });

        res.status(200).json({ message: 'OTP verified', token });
    }
};

const checkpoint = async (req: Request, res: Response) => {
    if (!req.auth?.email || !req.auth?.phone) {
        throw new UnauthorizedError('Request cannot be verified!');
    }

    const { email, phone } = req.auth;

    const { step } = req.body;
    if (step === CheckpointStep.CREDENTIALS) {
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
        const { name, redirect } = req.body;

        const digilocker = new DigiLockerService();
        const response = await digilocker.initialize({
            prefill_options: {
                full_name: name,
                mobile_number: phone,
                user_email: email,
            },
            expiry_minutes: 10,
            send_sms: false,
            send_email: false,
            verify_email: true,
            verify_phone: true,
            signup_flow: false,
            redirect_url: redirect ?? '',
            state: 'test',
        });

        const key = `digilocker:${email}`;
        await redisClient.set(key, response.data.data.client_id);
        await redisClient.expireAt(key, response.data.data.expiry_seconds);

        res.status(200).json({
            uri: response.data.data.url,
        });
    }
};

export { requestOtp, verifyOtp, checkpoint };
