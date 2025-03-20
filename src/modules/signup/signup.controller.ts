import { Response } from 'express';
import { Request } from 'express-jwt';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification, PhoneOtpVerification } from './signup.services';
import { BadRequestError, NotFoundError, UnauthorizedError, UnprocessableEntityError } from '@app/apiError';
import { db } from '@app/database';
import { CheckpointStep, JwtType, ValidationType } from './signup.types';
import { CredentialsType } from '@app/modules/common.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import AadhaarXMLParser from '@app/utils/aadhaar-xml.parser';
import { sign } from '@app/utils/jwt';
import axios from 'axios';
import { insertAddresGetId, insertNameGetId, updateCheckpoint } from '@app/database/transactions';
import splitName from '@app/utils/split-name';
import PanService from '@app/services/surepass/pan.service';
import { CREATED, NO_CONTENT, NOT_ACCEPTABLE, NOT_FOUND, OK, PAYMENT_REQUIRED } from '@app/utils/httpstatus';
import { BankVerification, ReversePenyDrop } from '@app/services/surepass/bank-verification';
import { randomUUID } from 'crypto';
import { imageUpload, wrappedMulterHandler } from '@app/services/multer-s3.service';
import logger from '@app/logger';
import razorPay from '@app/services/razorpay.service';

const requestOtp = async (req: Request, res: Response) => {
    const { type, phone, email } = req.body;
    if (type === CredentialsType.EMAIL) {
        const userExists = await db.selectFrom('user').where('email', '=', email).executeTakeFirst();
        if (userExists) {
            throw new BadRequestError('Email already exists');
        }

        const emailOtp = new EmailOtpVerification(email);
        await emailOtp.sendOtp();
    } else if (type === CredentialsType.PHONE) {
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

        const isVerified = await db
            .selectFrom('signup_checkpoints')
            .select('payment_id')
            .where('email', '=', email)
            .executeTakeFirst();

        if (!isVerified) {
            await redisClient.set(`need-payment:${email}`, 'true');
            await redisClient.expire(`need-payment:${email}`, 10 * 60);
        }

        await db.transaction().execute(async (tx) => {
            const existingCheckpoint = await tx
                .selectFrom('signup_checkpoints')
                .leftJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
                .select(['signup_checkpoints.id', 'signup_checkpoints.phone_id', 'phone_number.phone'])
                .where('email', '=', email)
                .executeTakeFirst();

            if (existingCheckpoint && existingCheckpoint.phone !== phone) {
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
        });

        const token = sign({ email, phone });

        res.status(OK).json({ message: 'OTP verified', token });
    }
};

const verify = async (req: Request, res: Response) => {
    const { email } = req.auth as JwtType;
    if (await redisClient.get(`need-payment:${email}`)) {
        res.status(PAYMENT_REQUIRED).json({ message: 'Needs verification' });
        return;
    }

    const isVerified = await db
        .selectFrom('signup_checkpoints')
        .select('payment_id')
        .where('email', '=', email)
        .executeTakeFirst();

    if (!isVerified) {
        throw new UnauthorizedError('Invalid session');
    }

    res.status(OK).json({ message: 'Account verified' });
};

const initiatePayment = async (req: Request, res: Response) => {
    const { email } = req.auth as JwtType;

    if (!(await redisClient.get(`need-payment:${email}`))) throw new UnauthorizedError('Unauthorized access');

    const order = await razorPay.createSignupOrder(email);

    res.status(OK).json({
        data: {
            orderId: order.id,
        },
        message: 'Order created',
    });
};

const verifyPayment = async (req: Request, res: Response) => {
    const { email, phone } = req.auth as JwtType;
    const { orderId, paymentId, signature } = req.body;

    if (!(await redisClient.get(`need-payment:${email}`))) throw new UnauthorizedError('Unauthorized access');

    const isVerified = razorPay.verifyOrder(orderId, paymentId, signature);
    if (!isVerified) throw new UnprocessableEntityError('Payment not verified');

    await db.transaction().execute(async (tx) => {
        const phoneId = await tx.insertInto('phone_number').values({ phone }).returning('id').executeTakeFirstOrThrow();

        const razorPayDataId = await tx
            .insertInto('razorpay_data')
            .values({ order_id: orderId, payment_id: paymentId, signature })
            .returning('order_id')
            .executeTakeFirstOrThrow();

        await tx
            .insertInto('signup_checkpoints')
            .values({ email, phone_id: phoneId.id, payment_id: razorPayDataId.order_id })
            .execute();
    });

    await redisClient.del(`need-payment:${email}`);

    res.status(OK).json({ message: 'Payment verified' });
};

const getCheckpoint = async (req: Request, res: Response) => {
    const { email } = req.auth as JwtType;

    const { step } = req.params;
    if (step === CheckpointStep.PAN) {
        const { pan_number } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .select('pan_detail.pan_number')
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { pan_number }, message: 'PAN number fetched' });
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
        const { father_name, mother_name, marital_status } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('user_name as father', 'signup_checkpoints.father_name', 'father.id')
            .innerJoin('user_name as mother', 'signup_checkpoints.mother_name', 'mother.id')
            .select([
                'father.full_name as father_name',
                'mother.full_name as mother_name',
                'signup_checkpoints.marital_status',
            ])
            .where('email', '=', email)
            .where('father_name', 'is not', null)
            .where('mother_name', 'is not', null)
            .where('marital_status', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { father_name, mother_name, marital_status }, message: 'User details fetched' });
    } else if (step === CheckpointStep.ACCOUNT_DETAIL) {
        const { annual_income, trading_exp, account_settlement } = await db
            .selectFrom('signup_checkpoints')
            .select(['annual_income', 'trading_exp', 'account_settlement'])
            .where('email', '=', email)
            .where('annual_income', 'is not', null)
            .where('trading_exp', 'is not', null)
            .where('account_settlement', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({
            data: { annual_income, trading_exp, account_settlement },
            message: 'Account details fetched',
        });
    } else if (step === CheckpointStep.OCCUPATION) {
        const { occupation, is_politically_exposed } = await db
            .selectFrom('signup_checkpoints')
            .select(['occupation', 'is_politically_exposed'])
            .where('email', '=', email)
            .where('occupation', 'is not', null)
            .where('is_politically_exposed', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { occupation, is_politically_exposed }, message: 'Occupation fetched' });
    } else if (step === CheckpointStep.BANK_VALIDATION) {
        const bank = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('bank_to_checkpoint', 'signup_checkpoints.id', 'bank_to_checkpoint.checkpoint_id')
            .innerJoin('bank_account', 'bank_to_checkpoint.bank_account_id', 'bank_account.id')
            .select(['bank_account.account_no', 'bank_account.ifsc_code'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { bank }, message: 'Bank details fetched' });
    } else {
        res.status(NOT_FOUND).json({ message: 'Checkpoint data not found' });
    }
};

const postCheckpoint = async (req: Request, res: Response) => {
    const { email, phone } = req.auth as JwtType;

    const { step } = req.body;
    if (step === CheckpointStep.PAN) {
        const { pan_number } = req.body;

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
                dob: new Date(panResponse.data.data.dob),
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
            data: {
                uri: digiResponse.data.data.url,
            },
            message: 'Digilocker URI generated',
        });
    } else if (step === CheckpointStep.AADHAAR) {
        // const details = await db
        //     .selectFrom('signup_checkpoints')
        //     .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
        //     .innerJoin('user_name', 'signup_checkpoints.name', 'user_name.id')
        //     .innerJoin('aadhaar_detail', 'signup_checkpoints.aadhaar_id', 'aadhaar_detail.id')
        //     .innerJoin('address', 'aadhaar_detail.address_id', 'address.id')
        //     .innerJoin('country', 'address.country_id', 'country.iso')
        //     .innerJoin('state', 'address.state_id', 'state.id')
        //     .innerJoin('city', 'address.city_id', 'city.id')
        //     .innerJoin('postal_code', 'address.postal_id', 'postal_code.id')
        //     .select([
        //         'user_name.full_name',
        //         'signup_checkpoints.dob',
        //         'aadhaar_detail.co',
        //         'aadhaar_detail.gender',
        //         'country.name as country',
        //         'state.name as state',
        //         'city.name as city',
        //         'postal_code.postal_code as postalCode',
        //         'address.address1',
        //         'address.address2',
        //         'address.street_name',
        //     ])
        //     .where('email', '=', email)
        //     .where('phone', '=', phone)
        //     .where('aadhaar_id', 'is not', null)
        //     .$narrowType<{ aadhaar_id: NotNull }>()
        //     .executeTakeFirst();
        //
        // if (details) {
        //     res.status(OK).json({
        //         data: {
        //             name: details.full_name,
        //             dob: details.dob,
        //             email,
        //             father_name: details.co,
        //             gender: details.gender,
        //             address: {
        //                 address1: details.address1,
        //                 address2: details.address2,
        //                 streetName: details.street_name,
        //                 city: details.city,
        //                 state: details.state,
        //                 country: details.country,
        //                 postalCode: details.postalCode,
        //             },
        //         },
        //         message: 'Aadhaar details already saved',
        //     });
        //     return;
        // }

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

        res.status(OK).json({
            // data: {
            //     name: parser.name(),
            //     dob: parser.dob(),
            //     email,
            //     father_name: parser.co(),
            //     gender: parser.gender(),
            //     address: parser.address(),
            // },
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

                await tx
                    .deleteFrom('bank_account')
                    .where(
                        'id',
                        'in',
                        deleted.map((d) => d.bank_account_id),
                    )
                    .execute();

                const bankId = await tx
                    .insertInto('bank_account')
                    .values({
                        account_no: rpcResponse.data.data.details.account_number,
                        ifsc_code: rpcResponse.data.data.details.ifsc,
                    })
                    .onConflict((oc) => oc.constraint('UQ_Bank_Account').doNothing())
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
            });

            await redisClient.del(`upi-validation:${email}`);

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

            if (!bankResponse.data.data.ifsc_details.micr !== bank.micr_code)
                throw new UnprocessableEntityError('MICR code does not match');

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

                await tx
                    .deleteFrom('bank_account')
                    .where(
                        'id',
                        'in',
                        deleted.map((d) => d.bank_account_id),
                    )
                    .execute();

                const bankId = await tx
                    .insertInto('bank_account')
                    .values({
                        account_no: bank.account_number,
                        ifsc_code: bank.ifsc_code,
                    })
                    .onConflict((oc) => oc.constraint('UQ_Bank_Account').doNothing())
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
            });

            res.status(CREATED).json({ message: 'Bank validation completed' });
        }
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
        // const { nominees } = req.body;
        // await db.transaction().execute(async (tx) => {
        //     const checkpointid = await tx
        //         .selectFrom('signup_checkpoints')
        //         .select('id')
        //         .where('email', '=', email)
        //         .executeTakeFirstOrThrow();

        //     await tx
        //         .deleteFrom('nominees_to_checkpoint')
        //         .where('checkpoint_id', '=', checkpointid.id)
        //         .execute();

        //     for (const nominee of nominees) {
        //         const nameId = await insertNameGetId(tx, splitName(nominee.name));

        //         await tx
        //             .insertInto('nominees_to_checkpoint')
        //             .values({
        //                 checkpoint_id: checkpointid.id,
        //                 name_id: nameId,
        //                 gov_id: nominee.gov_id,
        //             })
        //             .execute();
        //     }
        // });
        res.status(CREATED).json({ message: 'Nominees added' });
    }
};

const ipvImageUpload = wrappedMulterHandler(imageUpload.single('image'));
const putIpv = async (req: Request, res: Response) => {
    const { uid } = req.params;

    const { email, phone } = req.auth as JwtType;
    const value = await redisClient.get(`signup_ipv:${uid}`);
    if (!value || value !== email) throw new UnauthorizedError('IPV not authorized or expired.');

    let uploadResult;
    try {
        uploadResult = await ipvImageUpload(req, res);
    } catch (e: any) {
        throw new UnprocessableEntityError(e.message);
    }

    await db.transaction().execute(async (tx) => {
        await updateCheckpoint(tx, email, phone, {
            ipv: uploadResult.file.location,
        }).execute();
    });

    await redisClient.del(`signup_ipv:${uid}`);
    res.status(CREATED).json({
        message: 'IPV completed',
    });
};

const getIpv = async (req: Request, res: Response) => {
    const { email } = req.auth as JwtType;

    const url = await db.transaction().execute(async (tx) => {
        const ipv = await tx
            .selectFrom('signup_checkpoints')
            .select('ipv')
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        return ipv.ipv;
    });

    if (url === null) {
        res.status(NO_CONTENT).json({ message: 'IPV not uploaded' });
    } else {
        res.status(OK).json({ data: { url }, message: 'IPV completed.' });
    }
};

export { requestOtp, verifyOtp, verify, initiatePayment, verifyPayment, postCheckpoint, getCheckpoint, putIpv, getIpv };
