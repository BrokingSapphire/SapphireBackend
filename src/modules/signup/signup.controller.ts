import { Response } from 'express';
import { Request } from 'express-jwt';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, InternalServerError, UnauthorizedError, UnprocessableEntityError } from '@app/apiError';
import { db } from '@app/database';
import { JwtType, CredentialsType, CheckpointStep } from './signup.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import AadhaarXMLParser from '@app/utils/aadhaar-xml.parser';
import { sign } from '@app/utils/jwt';
import axios from 'axios';
import { insertAddresGetId, insertNameGetId, updateCheckpoint } from '@app/database/transactions';
import splitName from '@app/utils/split-name';

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
        if (!(await redisClient.get(`email-verified:${email}`))) throw new UnauthorizedError('Email not verified.');

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

    const { email, phone } = req.auth as JwtType;

    const { step } = req.body;
    if (step === CheckpointStep.CREDENTIALS) {
        await db.transaction().execute(async (tx) => {
            const phoneId = await tx.insertInto('phone_number').values({ phone }).returning('id').executeTakeFirst();
            await tx.insertInto('signup_checkpoints').values({ email, phone_id: phoneId!!.id }).execute();
        });

        res.status(200).json({ message: 'Credentials saved' });
    } else if (step === CheckpointStep.PAN) {
        const { pan_number, dob } = req.body;

        res.status(200).json({ message: 'PAN saved' });
    } else if (step === CheckpointStep.AADHAAR) {
        const { redirect } = req.body;

        const digilocker = new DigiLockerService();
        const response = await digilocker.initialize({
            prefill_options: {
                full_name: email.split('@')[0],
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
    } else if (step === CheckpointStep.KYC_DETAILS) {
        const clientId = await redisClient.get(`digilocker:${email}`);
        if (!clientId) throw new UnauthorizedError('Digilocker not authorized or expired.');

        const digilocker = new DigiLockerService();

        const status = await digilocker.getStatus(clientId);
        if (!status.data.data.completed) throw new UnauthorizedError('Digilocker not authorized or expired.');

        const documents = await digilocker.listDocuments(clientId);
        const aadhar = documents.data.data.documents.find((d: any) => d.doc_type === 'ADHAR');

        if (!aadhar) throw new UnprocessableEntityError("User doesn't have aadhar linked to his digilocker.");

        const downloadLink = await digilocker.downloadDocument(clientId, aadhar.file_id);
        if (downloadLink.data.data.mime_type !== 'application/xml')
            throw new UnprocessableEntityError("Don't know how to process aadhaar file.");

        const file = await axios.get(downloadLink.data.data.download_url);
        const parser = new AadhaarXMLParser(file.data);
        parser.load();

        await db.transaction().execute(async (tx) => {
            const address = parser.address();
            const addressId = await insertAddresGetId(tx, address);

            const nameId = await insertNameGetId(tx, splitName(parser.name()));

            const coId = await insertNameGetId(tx, splitName(parser.co()));

            const aadhaarId = await tx
                .insertInto('aadhaar_detail')
                .values({
                    masked_aadhaar_no: parser.uid().substring(9, 12),
                    name: nameId,
                    dob: parser.dob(),
                    co: coId,
                    address_id: addressId,
                    post_office: parser.postOffice(),
                    gender: parser.gender(),
                })
                .returning('id')
                .executeTakeFirstOrThrow();

            await updateCheckpoint(tx, email, phone, {
                aadhaar_id: aadhaarId.id,
            }).execute();
        });
    }
};

export { requestOtp, verifyOtp, checkpoint };
