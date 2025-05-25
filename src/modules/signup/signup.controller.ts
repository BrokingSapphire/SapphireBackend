import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    UnprocessableEntityError,
} from '@app/apiError';
import { db } from '@app/database';
import {
    CheckpointStep,
    PostCheckpointType,
    JwtType,
    RequestOtpType,
    ValidationType,
    VerifyOtpType,
    GetCheckpointType,
    UIDParams,
    AccountType,
} from './signup.types';
import { CredentialsType, ResponseWithToken } from '@app/modules/common.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import AadhaarXMLParser from '@app/utils/aadhaar-xml.parser';
import { sign } from '@app/utils/jwt';
import axios from 'axios';
import { insertAddressGetId, insertNameGetId, updateCheckpoint } from '@app/database/transactions';
import splitName from '@app/utils/split-name';
import PanService from '@app/services/surepass/pan.service';
import { CREATED, NO_CONTENT, NOT_ACCEPTABLE, NOT_FOUND, OK } from '@app/utils/httpstatus';
import { BankVerification, ReversePenyDrop } from '@app/services/surepass/bank-verification';
import { randomUUID } from 'crypto';
import { imageUpload, wrappedMulterHandler } from '@app/services/multer-s3.service';
import logger from '@app/logger';
import IdGenerator from '@app/services/id-generator';

const requestOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, RequestOtpType>,
    res: Response,
) => {
    const { type, email } = req.body;
    if (type === CredentialsType.EMAIL) {
        const userExists = await db.selectFrom('user').where('email', '=', email).executeTakeFirst();
        if (userExists) {
            throw new BadRequestError('Email already exists');
        }

        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.sendOtp();
    } else if (type === CredentialsType.PHONE) {
        const { phone } = req.body;
        const phoneExists = await db
            .selectFrom('user')
            .innerJoin('phone_number', 'user.phone', 'phone_number.id')
            .select('user.email')
            .where('phone_number.phone', '=', phone)
            .executeTakeFirst();
        if (phoneExists) {
            throw new BadRequestError('Phone number already exists');
        }

        const checkpointExists = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
            .select('signup_checkpoints.email')
            .where('phone_number.phone', '=', phone)
            .executeTakeFirst();
        if (checkpointExists && checkpointExists.email !== email) {
            throw new BadRequestError('Phone number already exists');
        }

        if (!(await redisClient.get(`email-verified:${email}`))) {
            throw new UnauthorizedError('Email not verified');
        }

        const phoneOtp = new PhoneOtpVerification(email, phone);
        await phoneOtp.sendOtp();
    }

    res.status(OK).json({ message: 'OTP sent' });
};

const verifyOtp = async (
    req: Request<undefined, ParamsDictionary, ResponseWithToken, VerifyOtpType>,
    res: Response<ResponseWithToken>,
) => {
    const { type, email, otp } = req.body;
    if (type === CredentialsType.EMAIL) {
        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.verifyOtp(otp);
        await redisClient.set(`email-verified:${email}`, 'true');
        await redisClient.expire(`email-verified:${email}`, 10 * 60);

        res.status(OK).json({ message: 'OTP verified' });
    } else if (type === CredentialsType.PHONE) {
        const { phone } = req.body;
        if (!(await redisClient.get(`email-verified:${email}`))) throw new UnauthorizedError('Email not verified.');

        const phoneOtp = new PhoneOtpVerification(email, phone);
        await phoneOtp.verifyOtp(otp);
        await redisClient.del(`email-verified:${email}`);

        const { client_id } = await db.transaction().execute(async (tx) => {
            const existingCheckpoint = await tx
                .selectFrom('signup_checkpoints')
                .leftJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
                .select([
                    'signup_checkpoints.id',
                    'signup_checkpoints.phone_id',
                    'phone_number.phone',
                    'signup_checkpoints.client_id',
                ])
                .where('email', '=', email)
                .executeTakeFirst();

            if (existingCheckpoint) {
                if (existingCheckpoint.phone !== phone) {
                    const phoneId = await tx
                        .insertInto('phone_number')
                        .values({ phone })
                        .returning('id')
                        .executeTakeFirstOrThrow();

                    await tx
                        .updateTable('signup_checkpoints')
                        .set({ phone_id: phoneId.id })
                        .where('id', '=', existingCheckpoint.id)
                        .execute();

                    await tx.deleteFrom('phone_number').where('id', '=', existingCheckpoint.phone_id).execute();
                }

                return existingCheckpoint;
            } else {
                const phoneId = await tx
                    .insertInto('phone_number')
                    .values({ phone })
                    .returning('id')
                    .executeTakeFirstOrThrow();

                const checkpoint = await tx
                    .insertInto('signup_checkpoints')
                    .values({ email, phone_id: phoneId.id })
                    .returning('id')
                    .executeTakeFirstOrThrow();

                await tx.insertInto('signup_verification_status').values({ id: checkpoint.id }).execute();

                return { client_id: null };
            }
        });

        const token = sign<JwtType>({ email, phone });

        res.status(OK).json({ message: 'OTP verified', token, data: { clientId: client_id } });
    }
};

const getCheckpoint = async (req: Request<JwtType, GetCheckpointType>, res: Response) => {
    const { email } = req.auth!;

    const { step } = req.params;
    if (step === CheckpointStep.PAN) {
        const { pan_number, full_name, dob } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
            .select(['pan_detail.pan_number', 'user_name.full_name', 'pan_detail.dob'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { pan_number, full_name, dob }, message: 'PAN number fetched' });
    } else if (step === CheckpointStep.AADHAAR) {
        const { masked_aadhaar_no } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('aadhaar_detail', 'signup_checkpoints.aadhaar_id', 'aadhaar_detail.id')
            .select('aadhaar_detail.masked_aadhaar_no')
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({
            data: { aadhaar_no: `XXXXXXXX${masked_aadhaar_no}` },
            message: 'Aadhaar number fetched',
        });
    } else if (step === CheckpointStep.INVESTMENT_SEGMENT) {
        const segments = await db
            .selectFrom('signup_checkpoints')
            .innerJoin(
                'investment_segments_to_checkpoint',
                'signup_checkpoints.id',
                'investment_segments_to_checkpoint.checkpoint_id',
            )
            .select('investment_segments_to_checkpoint.segment')
            .where('email', '=', email)
            .execute();

        res.status(OK).json({
            data: { segments: segments.map((s) => s.segment) },
            message: 'Investment segment fetched',
        });
    } else if (step === CheckpointStep.USER_DETAIL) {
        const { father_name, mother_name } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('user_name as father', 'signup_checkpoints.father_name', 'father.id')
            .innerJoin('user_name as mother', 'signup_checkpoints.mother_name', 'mother.id')
            .select(['father.full_name as father_name', 'mother.full_name as mother_name'])
            .where('email', '=', email)
            .where('father_name', 'is not', null)
            .where('mother_name', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { father_name, mother_name }, message: 'User details fetched' });
    } else if (step === CheckpointStep.PERSONAL_DETAIL) {
        const { marital_status, annual_income, trading_exp, account_settlement } = await db
            .selectFrom('signup_checkpoints')
            .select(['marital_status', 'annual_income', 'trading_exp', 'account_settlement'])
            .where('email', '=', email)
            .where('marital_status', 'is not', null)
            .where('annual_income', 'is not', null)
            .where('trading_exp', 'is not', null)
            .where('account_settlement', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({
            data: {
                marital_status,
                annual_income,
                trading_exp,
                acc_settlement: account_settlement,
            },
            message: 'Personal details fetched',
        });
    } else if (step === CheckpointStep.OTHER_DETAIL) {
        const { occupation, is_politically_exposed } = await db
            .selectFrom('signup_checkpoints')
            .select(['occupation', 'is_politically_exposed'])
            .where('email', '=', email)
            .where('occupation', 'is not', null)
            .where('is_politically_exposed', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { occupation, is_politically_exposed }, message: 'Other details fetched' });
    } else if (step === CheckpointStep.BANK_VALIDATION) {
        const bank = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('bank_to_checkpoint', 'signup_checkpoints.id', 'bank_to_checkpoint.checkpoint_id')
            .innerJoin('bank_account', 'bank_to_checkpoint.bank_account_id', 'bank_account.id')
            .select(['bank_account.account_no', 'bank_account.ifsc_code', 'bank_account.account_type'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { bank }, message: 'Bank details fetched' });
    } else if (step === CheckpointStep.ADD_NOMINEES) {
        const nominees = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('nominees_to_checkpoint', 'signup_checkpoints.id', 'nominees_to_checkpoint.checkpoint_id')
            .innerJoin('nominees', 'nominees_to_checkpoint.nominees_id', 'nominees.id')
            .innerJoin('user_name', 'nominees.name', 'user_name.id')
            .select(['user_name.full_name as name', 'nominees.govt_id', 'nominees.relationship', 'nominees.share'])
            .where('email', '=', email)
            .execute();

        if (nominees.length === 0) {
            res.status(NO_CONTENT).json({ message: 'No nominees found' });
            return;
        }

        const formattedNominees = nominees.map((nominee) => ({
            name: nominee.name,
            govId: nominee.govt_id,
            idType: nominee.govt_id.length === 12 ? 'AADHAAR' : 'PAN',
            relation: nominee.relationship,
            share: nominee.share,
        }));

        res.status(OK).json({
            data: { nominees: formattedNominees },
            message: 'Nominees fetched successfully',
        });
    } else {
        res.status(NOT_FOUND).json({ message: 'Checkpoint data not found' });
    }
};

const postCheckpoint = async (
    req: Request<JwtType, ParamsDictionary, DefaultResponseData, PostCheckpointType>,
    res: Response,
) => {
    const { email, phone } = req.auth!;

    const { step } = req.body;
    if (step === CheckpointStep.PAN) {
        const { pan_number } = req.body;

        const exists = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .select(['pan_detail.id', 'pan_detail.pan_number'])
            .where('signup_checkpoints.email', '=', email)
            .executeTakeFirst();

        if (exists && exists.pan_number === pan_number) {
            res.status(OK).json({ message: 'PAN already verified' });
            return;
        }

        const panService = new PanService();
        let panResponse;
        try {
            panResponse = await panService.getDetails(pan_number);
        } catch (error: any) {
            if (error.response) {
                logger.error(error.response.data);
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

        await db.transaction().execute(async (tx) => {
            const nameId = await insertNameGetId(tx, splitName(panResponse.data.data.full_name));

            const address = panResponse.data.data.address;
            const addressId = await insertAddressGetId(tx, {
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

            const checkpoint = await updateCheckpoint(tx, email, phone, {
                name: nameId,
                dob: new Date(panResponse.data.data.dob),
                pan_id: panId.id,
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({ pan_status: 'pending', updated_at: new Date() })
                .where('id', '=', checkpoint.id)
                .execute();

            if (exists) {
                await tx.deleteFrom('pan_detail').where('id', '=', exists.id).execute();
            }
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
            redirect_url: redirect,
            state: 'test',
        });

        const key = `digilocker:${email}`;
        await redisClient.set(key, digiResponse.data.data.client_id);
        await redisClient.expire(key, digiResponse.data.data.expiry_seconds);

        res.status(OK).json({
            data: {
                uri: digiResponse.data.data.url,
            },
            message: 'Digilocker URI generated',
        });
    } else if (step === CheckpointStep.AADHAAR) {
        const clientId = await redisClient.get(`digilocker:${email}`);
        if (!clientId) throw new UnauthorizedError('Digilocker not authorized or expired.');

        const digilocker = new DigiLockerService();

        const status = await digilocker.getStatus(clientId);
        if (!status.data.data.completed) throw new UnauthorizedError('Digilocker status incomplete');

        await redisClient.del(`digilocker:${email}`);

        const documents = await digilocker.listDocuments(clientId);
        const aadhaar = documents.data.data.documents.find((d: any) => d.doc_type === 'ADHAR');

        if (!aadhaar) throw new UnprocessableEntityError("User doesn't have aadhaar linked to his digilocker.");

        const downloadLink = await digilocker.downloadDocument(clientId, aadhaar.file_id);
        if (downloadLink.data.data.mime_type !== 'application/xml')
            throw new UnprocessableEntityError("Don't know how to process aadhaar file.");

        const file = await axios.get(downloadLink.data.data.download_url);
        const parser = new AadhaarXMLParser(file.data);
        parser.load();

        await db.transaction().execute(async (tx) => {
            const address = parser.address();
            const addressId = await insertAddressGetId(tx, address);

            const nameId = await insertNameGetId(tx, splitName(parser.name()));

            let co = parser.co();
            if (co.startsWith('C/O')) co = co.substring(4).trim();
            const coId = await insertNameGetId(tx, splitName(co));

            const exists = await tx
                .selectFrom('signup_checkpoints')
                .select('aadhaar_id')
                .where('email', '=', email)
                .executeTakeFirst();

            if (exists && exists.aadhaar_id) {
                await updateCheckpoint(tx, email, phone, {
                    aadhaar_id: null,
                }).execute();

                await tx.deleteFrom('aadhaar_detail').where('address_id', '=', exists.aadhaar_id).execute();
            }

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

            const checkpoint = await updateCheckpoint(tx, email, phone, {
                aadhaar_id: aadhaarId.id,
                address_id: addressId,
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({
                    aadhaar_status: 'pending',
                    address_status: 'pending',
                    updated_at: new Date(),
                })
                .where('id', '=', checkpoint.id)
                .execute();
        });

        res.status(OK).json({
            message: 'Aadhaar verified',
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
                    segments.map((segment) => ({
                        checkpoint_id: signupCheckpoint.id,
                        segment,
                    })),
                )
                .execute();
        });

        res.status(CREATED).json({ message: 'Investment segment saved' });
    } else if (step === CheckpointStep.USER_DETAIL) {
        const { father_name, mother_name } = req.body;

        await db.transaction().execute(async (tx) => {
            const fatherNameId = await insertNameGetId(tx, splitName(father_name));
            const motherNameId = await insertNameGetId(tx, splitName(mother_name));

            await updateCheckpoint(tx, email, phone, {
                father_name: fatherNameId,
                mother_name: motherNameId,
            }).execute();
        });

        res.status(CREATED).json({ message: 'User details saved' });
    } else if (step === CheckpointStep.PERSONAL_DETAIL) {
        const { marital_status, annual_income, trading_exp, acc_settlement } = req.body;

        await db.transaction().execute(async (tx) => {
            const checkpoint = await updateCheckpoint(tx, email, phone, {
                marital_status,
                annual_income,
                trading_exp,
                account_settlement: acc_settlement,
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({ trading_preferences_status: 'pending', updated_at: new Date() })
                .where('id', '=', checkpoint.id)
                .execute();
        });

        res.status(CREATED).json({ message: 'Personal details saved' });
    } else if (step === CheckpointStep.OTHER_DETAIL) {
        const { occupation, politically_exposed } = req.body;
        await db.transaction().execute(async (tx) => {
            const checkpoint = await updateCheckpoint(tx, email, phone, {
                occupation,
                is_politically_exposed: politically_exposed,
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({ trading_preferences_status: 'pending', updated_at: new Date() })
                .where('id', '=', checkpoint.id)
                .execute();
        });

        res.status(CREATED).json({ message: 'Other details saved' });
    } else if (step === CheckpointStep.BANK_VALIDATION_START) {
        const { validation_type } = req.body;
        if (validation_type === ValidationType.UPI) {
            const rpc = new ReversePenyDrop();
            const rpcResponse = await rpc.initialize();

            await redisClient.set(`upi-validation:${email}`, rpcResponse.data.data.client_id);

            res.status(OK).json({
                data: {
                    payment_link: rpcResponse.data.data.payment_link,
                    ios_links: {
                        paytm: rpcResponse.data.data.ios_links.paytm,
                        phonepe: rpcResponse.data.data.ios_links.phonepe,
                        gpay: rpcResponse.data.data.ios_links.gpay,
                        bhim: rpcResponse.data.data.ios_links.bhim,
                        whatsapp: rpcResponse.data.data.ios_links.whatsapp,
                    },
                },
                message: 'UPI validation started',
            });
        } else {
            res.status(OK).json({ message: 'Bank validation started' });
        }
    } else if (step === CheckpointStep.BANK_VALIDATION) {
        const { validation_type } = req.body;
        if (validation_type === ValidationType.UPI) {
            const clientId = await redisClient.get(`upi-validation:${email}`);
            if (!clientId) throw new UnauthorizedError('UPI validation not authorized or expired.');

            const rpc = new ReversePenyDrop();
            const rpcResponse = await rpc.status(clientId);

            if (rpcResponse.data.message_code === 'pending') {
                res.status(NO_CONTENT).json({ message: 'UPI validation pending' });
                return;
            }

            if (rpcResponse.data.data.status === 'failed') {
                res.status(NOT_ACCEPTABLE).json({ message: 'UPI validation failed' });
                return;
            }

            await redisClient.del(`upi-validation:${email}`);

            await db.transaction().execute(async (tx) => {
                const checkpointId = await tx
                    .selectFrom('signup_checkpoints')
                    .select('id')
                    .where('email', '=', email)
                    .executeTakeFirstOrThrow();

                const deleted = await tx
                    .deleteFrom('bank_to_checkpoint')
                    .where('checkpoint_id', '=', checkpointId.id)
                    .returning('bank_account_id')
                    .execute();

                if (deleted.length > 0) {
                    await tx
                        .deleteFrom('bank_account')
                        .where(
                            'id',
                            'in',
                            deleted.map((d) => d.bank_account_id),
                        )
                        .execute();
                }

                const bankId = await tx
                    .insertInto('bank_account')
                    .values({
                        account_no: rpcResponse.data.data.details.account_number,
                        ifsc_code: rpcResponse.data.data.details.ifsc,
                        verification: 'verified',
                        account_type: AccountType.SAVINGS,
                    })
                    .onConflict((oc) =>
                        oc.constraint('uq_bank_account').doUpdateSet((eb) => ({
                            account_no: eb.ref('excluded.account_no'),
                        })),
                    )
                    .returning('id')
                    .executeTakeFirstOrThrow();

                await tx
                    .insertInto('bank_to_checkpoint')
                    .values({
                        checkpoint_id: checkpointId.id,
                        bank_account_id: bankId.id,
                        is_primary: true,
                    })
                    .execute();

                await tx
                    .updateTable('signup_verification_status')
                    .set({ bank_status: 'pending', updated_at: new Date() })
                    .where('id', '=', checkpointId.id)
                    .execute();
            });

            res.status(CREATED).json({ message: 'UPI validation completed' });
        } else {
            const { bank } = req.body;

            const verification = new BankVerification();
            const bankResponse = await verification.verification({
                id_number: bank.account_number,
                ifsc: bank.ifsc_code,
                ifsc_details: true,
            });

            if (!bankResponse.data.data.account_exists)
                throw new UnprocessableEntityError('Bank account does not exist');

            await db.transaction().execute(async (tx) => {
                const checkpointId = await tx
                    .selectFrom('signup_checkpoints')
                    .select('id')
                    .where('email', '=', email)
                    .executeTakeFirstOrThrow();

                const deleted = await tx
                    .deleteFrom('bank_to_checkpoint')
                    .where('checkpoint_id', '=', checkpointId.id)
                    .returning('bank_account_id')
                    .execute();

                if (deleted.length > 0) {
                    await tx
                        .deleteFrom('bank_account')
                        .where(
                            'id',
                            'in',
                            deleted.map((d) => d.bank_account_id),
                        )
                        .execute();
                }

                const bankId = await tx
                    .insertInto('bank_account')
                    .values({
                        account_no: bank.account_number,
                        ifsc_code: bank.ifsc_code,
                        account_type: bank.account_type,
                        verification: 'verified',
                    })
                    .onConflict((oc) =>
                        oc.constraint('uq_bank_account').doUpdateSet((eb) => ({
                            account_no: eb.ref('excluded.account_no'),
                            account_type: eb.ref('excluded.account_type'),
                        })),
                    )
                    .returning('id')
                    .executeTakeFirstOrThrow();

                await tx
                    .insertInto('bank_to_checkpoint')
                    .values({
                        checkpoint_id: checkpointId.id,
                        bank_account_id: bankId.id,
                        is_primary: true,
                    })
                    .execute();

                await tx
                    .updateTable('signup_verification_status')
                    .set({ bank_status: 'pending', updated_at: new Date() })
                    .where('id', '=', checkpointId.id)
                    .execute();
            });

            res.status(CREATED).json({ message: 'Bank validation completed' });
        }
    } else if (step === CheckpointStep.SIGNATURE) {
        const uid = randomUUID();

        await redisClient.set(`signup_signature:${uid}`, email);
        await redisClient.expire(`signup_signature:${uid}`, 10 * 60);

        res.status(OK).json({
            data: {
                uid,
            },
            message: 'Signature started',
        });
    } else if (step === CheckpointStep.IPV) {
        const uid = randomUUID();

        await redisClient.set(`signup_ipv:${uid}`, email);
        await redisClient.expire(`signup_ipv:${uid}`, 10 * 60);

        res.status(OK).json({
            data: {
                uid,
            },
            message: 'IPV started',
        });
    } else if (step === CheckpointStep.ADD_NOMINEES) {
        const { nominees } = req.body;

        // FIXME
        // Validate total share percentage equals 100%
        // const totalShare = nominees.reduce((sum, nominee) => sum + nominee.share, 0);
        // if (totalShare !== 100) {
        //     throw new UnprocessableEntityError('Total nominee share must equal 100%');
        // }

        await db.transaction().execute(async (tx) => {
            const checkpointId = await tx
                .selectFrom('signup_checkpoints')
                .select('id')
                .where('email', '=', email)
                .executeTakeFirstOrThrow();

            if (nominees.length > 0) {
                const deleted = await tx
                    .deleteFrom('nominees_to_checkpoint')
                    .where('checkpoint_id', '=', checkpointId.id)
                    .returning('nominees_id')
                    .execute();

                if (deleted.length > 0) {
                    await tx
                        .deleteFrom('nominees')
                        .where(
                            'id',
                            'in',
                            deleted.map((it) => it.nominees_id),
                        )
                        .execute();
                }

                const nameIds = await insertNameGetId(
                    tx,
                    nominees.map((it) => splitName(it.name)),
                );

                const inserted = await tx
                    .insertInto('nominees')
                    .values(
                        nominees.map((it, index) => ({
                            name: nameIds[index],
                            govt_id: it.gov_id,
                            relationship: it.relation,
                            share: it.share,
                        })),
                    )
                    .returning('id')
                    .execute();

                await tx
                    .insertInto('nominees_to_checkpoint')
                    .values(
                        inserted.map((id) => ({
                            checkpoint_id: checkpointId.id,
                            nominees_id: id.id,
                        })),
                    )
                    .execute();
            }

            await tx
                .updateTable('signup_verification_status')
                .set({ nominee_status: 'pending', updated_at: new Date() })
                .where('id', '=', checkpointId.id)
                .execute();
        });

        res.status(CREATED).json({ message: 'Nominees added.' });
    }
};

const ipvImageUpload = wrappedMulterHandler(imageUpload.single('image'));
const putIpv = async (req: Request<JwtType, UIDParams>, res: Response) => {
    const { uid } = req.params;

    const { email, phone } = req.auth!;
    const value = await redisClient.get(`signup_ipv:${uid}`);
    if (!value || value !== email) throw new UnauthorizedError('IPV not authorized or expired.');

    let uploadResult;
    try {
        uploadResult = await ipvImageUpload(req, res);
    } catch (e: any) {
        throw new UnprocessableEntityError(e.message);
    }

    await db.transaction().execute(async (tx) => {
        const checkpoint = await updateCheckpoint(tx, email, phone, {
            ipv: uploadResult.file.location,
        })
            .returning('id')
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('signup_verification_status')
            .set({ ipv_status: 'pending', updated_at: new Date() })
            .where('id', '=', checkpoint.id)
            .execute();
    });

    await redisClient.del(`signup_ipv:${uid}`);
    res.status(CREATED).json({
        message: 'IPV completed',
    });
};

const getIpv = async (req: Request<JwtType>, res: Response) => {
    const { email } = req.auth!;

    const { ipv: url } = await db
        .selectFrom('signup_checkpoints')
        .select('ipv')
        .where('email', '=', email)
        .executeTakeFirstOrThrow();

    if (url === null) {
        res.status(NO_CONTENT).json({ message: 'IPV not uploaded' });
    } else {
        res.status(OK).json({ data: { url }, message: 'IPV completed.' });
    }
};

const putSignature = async (req: Request<JwtType, UIDParams>, res: Response) => {
    const { uid } = req.params;

    const { email, phone } = req.auth!!;
    const value = await redisClient.get(`signup_signature:${uid}`);
    if (!value || value !== email) throw new UnauthorizedError('Signature uri not authorized or expired.');

    let uploadResult;
    try {
        uploadResult = await ipvImageUpload(req, res);
    } catch (e: any) {
        throw new UnprocessableEntityError(e.message);
    }

    await db.transaction().execute(async (tx) => {
        const checkpoint = await updateCheckpoint(tx, email, phone, {
            signature: uploadResult.file.location,
        })
            .returning('id')
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('signup_verification_status')
            .set({ signature_status: 'pending', updated_at: new Date() })
            .where('id', '=', checkpoint.id)
            .execute();
    });

    await redisClient.del(`signup_signature:${uid}`);
    res.status(CREATED).json({
        message: 'Signature completed',
    });
};

const getSignature = async (req: Request<JwtType>, res: Response) => {
    const { email } = req.auth!;

    const { signature: url } = await db
        .selectFrom('signup_checkpoints')
        .select('signature')
        .where('email', '=', email)
        .executeTakeFirstOrThrow();

    if (url === null) {
        res.status(NO_CONTENT).json({ message: 'Signature not uploaded' });
    } else {
        res.status(OK).json({ data: { url }, message: 'Signature completed.' });
    }
};

const finalizeSignup = async (req: Request<JwtType>, res: Response) => {
    const { email } = req.auth!;

    const hasClientId = await db
        .selectFrom('signup_checkpoints')
        .select('client_id')
        .where('email', '=', email)
        .executeTakeFirstOrThrow();

    if (hasClientId.client_id) {
        throw new ForbiddenError('Client ID already exists');
    }

    // TODO: Add more verification for fields

    const id = await new IdGenerator('user_id').nextValue();

    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('signup_checkpoints')
            .set({
                client_id: id,
            })
            .where('email', '=', email)
            .execute();
    });

    res.status(CREATED).json({
        message: 'Sign up successfully.',
        data: {
            clientId: id,
        },
    });
};

export {
    requestOtp,
    verifyOtp,
    postCheckpoint,
    getCheckpoint,
    putIpv,
    getIpv,
    putSignature,
    getSignature,
    finalizeSignup,
};
