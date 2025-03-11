import { response, Response } from 'express';
import { Request } from 'express-jwt';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, NotFoundError, UnauthorizedError, UnprocessableEntityError } from '@app/apiError';
import { db } from '@app/database';
import { JwtType, CredentialsType, CheckpointStep } from './signup.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import AadhaarXMLParser from '@app/utils/aadhaar-xml.parser';
import { sign } from '@app/utils/jwt';
import axios from 'axios';
import { insertAddresGetId, insertNameGetId, updateCheckpoint } from '@app/database/transactions';
import splitName from '@app/utils/split-name';
import { NotNull } from 'kysely';
import PanService from '@app/services/surepass/pan.service';
import { CREATED, OK } from '@app/utils/httpstatus';

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

    res.status(OK).json({ message: 'OTP sent' });
};

const verifyOtp = async (req: Request, res: Response) => {
    const { type, phone, email, otp } = req.body;
    if (type === CredentialsType.EMAIL) {
        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.verifyOtp(otp);
        await redisClient.set(`email-verified:${email}`, 'true');
        await redisClient.expire(`email-verified:${email}`, 10 * 60);

        res.status(OK).json({ message: 'OTP verified' });
    } else if (type === CredentialsType.PHONE) {
        if (!(await redisClient.get(`email-verified:${email}`))) throw new UnauthorizedError('Email not verified.');

        const phoneOtp = new PhoneOtpVerification(phone);
        await phoneOtp.verifyOtp(otp);
        await redisClient.del(`email-verified:${email}`);

        const token = sign({
            email,
            phone,
        });

        res.status(OK).json({ message: 'OTP verified', token });
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
            const phoneId = await tx
                .insertInto('phone_number')
                .values({ phone })
                .returning('id')
                .executeTakeFirstOrThrow();
            await tx.insertInto('signup_checkpoints').values({ email, phone_id: phoneId.id }).execute();
        });

        res.status(CREATED).json({ message: 'Credentials saved' });
    } else if (step === CheckpointStep.PAN) {
        const { panNumber, dob } = req.body;

        const panService = new PanService();
        let panResponse;
        try {
            panResponse = await panService.getDetails(panNumber);
        } catch (error: any) {
            if (error.response) {
                if (error.response.data.error.code === 'INVALID_PAN') {
                    throw new UnprocessableEntityError('Invalid PAN number');
                }
            }
            throw error;
        }

        if (panResponse.status !== OK) {
            throw new NotFoundError('Pan details not found.');
        }

        if (panResponse.data.data.email && panResponse.data.data.email !== email) {
            throw new UnprocessableEntityError('Email does not match.');
        }

        if (panResponse.data.data.phone_number && panResponse.data.data.phone_number !== phone) {
            throw new UnprocessableEntityError('Phone does not match.');
        }

        if (new Date(panResponse.data.data.dob) !== new Date(dob)) {
            throw new UnprocessableEntityError('DOB does not match.');
        }

        await db.transaction().execute(async (tx) => {
            const nameId = await insertNameGetId(tx, splitName(panResponse.data.data.full_name));

            const address = panResponse.data.data.address;
            const addressId = await insertAddresGetId(tx, {
                address1: address.line_1,
                address2: address.line_2,
                streetName: address.street_name,
                city: address.city,
                state: address.state,
                country: address.country === '' ? 'India' : address.country,
                postalCode: address.zip,
            });

            const panId = await tx
                .insertInto('pan_detail')
                .values({
                    pan_number: panResponse.data.data.pan_number,
                    name: nameId,
                    masked_aadhaar: panResponse.data.data.masked_aadhaar.substring(9, 12),
                    address_id: addressId,
                    dob: new Date(panResponse.data.data.dob),
                    gender: panResponse.data.data.gender,
                    aadhaar_linked: panResponse.data.data.aadhaar_linked,
                    dob_verified: panResponse.data.data.dob_verified,
                    dob_check: panResponse.data.data.dob_check,
                    category: panResponse.data.data.category,
                    status: panResponse.data.data.status,
                })
                .returning('id')
                .executeTakeFirstOrThrow();

            await updateCheckpoint(tx, email, phone, {
                name: nameId,
                dob: new Date(dob),
                pan_id: panId.id,
            }).execute();
        });

        res.status(OK).json({ message: 'PAN verified' });
    } else if (step === CheckpointStep.AADHAAR_URI) {
        const { redirect } = req.body;

        const digilocker = new DigiLockerService();
        const digiResponse = await digilocker.initialize({
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
        await redisClient.set(key, digiResponse.data.data.client_id);
        await redisClient.expireAt(key, digiResponse.data.data.expiry_seconds);

        res.status(OK).json({
            uri: digiResponse.data.data.url,
        });
    } else if (step === CheckpointStep.AADHAAR) {
        const details = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
            .innerJoin('user_name', 'signup_checkpoints.name', 'user_name.id')
            .innerJoin('aadhaar_detail', 'signup_checkpoints.aadhaar_id', 'aadhaar_detail.id')
            .innerJoin('address', 'aadhaar_detail.address_id', 'address.id')
            .innerJoin('country', 'address.country_id', 'country.iso')
            .innerJoin('state', 'address.state_id', 'state.id')
            .innerJoin('city', 'address.city_id', 'city.id')
            .innerJoin('postal_code', 'address.postal_id', 'postal_code.id')
            .select([
                'user_name.full_name',
                'signup_checkpoints.dob',
                'aadhaar_detail.co',
                'aadhaar_detail.gender',
                'country.name as country',
                'state.name as state',
                'city.name as city',
                'postal_code.postal_code as postalCode',
                'address.address1',
                'address.address2',
                'address.street_name',
            ])
            .where('email', '=', email)
            .where('phone', '=', phone)
            .where('aadhaar_id', 'is not', null)
            .$narrowType<{ aadhaar_id: NotNull }>()
            .executeTakeFirst();

        if (details) {
            res.status(OK).json({
                name: details.full_name,
                dob: details.dob,
                email,
                father_name: details.co,
                gender: details.gender,
                address: {
                    address1: details.address1,
                    address2: details.address2,
                    streetName: details.street_name,
                    city: details.city,
                    state: details.state,
                    country: details.country,
                    postalCode: details.postalCode,
                },
            });
            return;
        }

        const clientId = await redisClient.get(`digilocker:${email}`);
        if (!clientId) throw new UnauthorizedError('Digilocker not authorized or expired.');
        await redisClient.del(`digilocker:${email}`);

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

            let co = parser.co();
            if (co.startsWith('C/O')) co = co.substring(4).trim();
            const coId = await insertNameGetId(tx, splitName(co));

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
                address_id: addressId,
            }).execute();
        });

        res.status(CREATED).json({
            name: parser.name(),
            dob: parser.dob(),
            email,
            father_name: parser.co(),
            gender: parser.gender(),
            address: parser.address(),
        });
    } else if (step === CheckpointStep.INVESTMENT_SEGMENT) {
        const { segments } = req.body;
        await db.transaction().execute(async (tx) => {
            const signupCheckpoint = await tx
                .selectFrom('signup_checkpoints')
                .select('id')
                .where('email', '=', email)
                .executeTakeFirstOrThrow();

            await tx
                .deleteFrom('investment_segments_to_checkpoint')
                .where('checkpoint_id', '=', signupCheckpoint.id)
                .execute();

            await tx
                .insertInto('investment_segments_to_checkpoint')
                .values(
                    segments.map((segment: string) => ({
                        checkpoint_id: signupCheckpoint.id,
                        segment,
                    })),
                )
                .execute();
        });

        res.status(CREATED).json({ message: 'Investment segment saved' });
    } else if (step === CheckpointStep.USER_DETAIL) {
        const { marital_status, father_name, mother_name } = req.body;

        await db.transaction().execute(async (tx) => {
            const fatherNameId = await insertNameGetId(tx, splitName(father_name));
            const motherNameId = await insertNameGetId(tx, splitName(mother_name));

            await updateCheckpoint(tx, email, phone, {
                marital_status,
                father_name: fatherNameId,
                mother_name: motherNameId,
            }).execute();
        });

        res.status(CREATED).json({ message: 'User details saved' });
    } else if (step === CheckpointStep.ACCOUNT_DETAIL) {
        const { annual_income, experience, settlement } = req.body;
        await db.transaction().execute(async (tx) => {
            await updateCheckpoint(tx, email, phone, {
                annual_income,
                trading_exp: experience,
                account_settlement: settlement,
            }).execute();
        });

        res.status(CREATED).json({ message: 'Account details saved' });
    } else if (step === CheckpointStep.OCCUPATION) {
        const { occupation, politically_exposed } = req.body;
        await db.transaction().execute(async (tx) => {
            await updateCheckpoint(tx, email, phone, {
                occupation,
                is_politically_exposed: politically_exposed,
            }).execute();
        });

        res.status(CREATED).json({ message: 'Occupation saved' });
    }
};

export { requestOtp, verifyOtp, checkpoint };
