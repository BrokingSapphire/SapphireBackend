import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import redisClient from '@app/services/redis.service';
import { hashPassword } from '@app/utils/passwords';
import { EmailOtpVerification, PhoneOtpVerification } from '@app/services/otp.service';
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
    ResendOtpType,
} from './signup.types';
import { CredentialsType, ResponseWithToken } from '@app/modules/common.types';
import DigiLockerService from '@app/services/surepass/digilocker.service';
import ESignService from '@app/services/surepass/esign.service';
import AadhaarXMLParser from '@app/utils/aadhaar-xml.parser';
import { sign } from '@app/utils/jwt';
import axios from 'axios';
import { insertAddressGetId, insertNameGetId, updateCheckpoint } from '@app/database/transactions';
import splitName from '@app/utils/split-name';
import PanService from '@app/services/surepass/pan.service';
import { CREATED, NO_CONTENT, NOT_ACCEPTABLE, NOT_FOUND, OK } from '@app/utils/httpstatus';
import { BankVerification, ReversePenyDrop } from '@app/services/surepass/bank-verification';
import { randomUUID } from 'crypto';
import { imageUpload, pdfUpload, wrappedMulterHandler } from '@app/services/multer-s3.service';
import logger from '@app/logger';
import IdGenerator from '@app/services/id-generator';
import { sendDocumentsReceivedConfirmation } from '@app/services/notification.service';
import s3Service from '@app/services/s3.service';
import { SmsTemplateType } from '@app/services/sms-templates/sms.types';
import smsService from '@app/services/sms.service';

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

        const emailOtp = new EmailOtpVerification(email, 'signup');
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

        const phoneOtp = new PhoneOtpVerification(email, 'signup', phone);
        await phoneOtp.sendOtp();
    }

    res.status(OK).json({ message: 'OTP sent' });
};

// resendOTP

const resendOtp = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, ResendOtpType>,
    res: Response,
) => {
    const { type, email } = req.body;
    const rateLimitKey = `resend-otp-limit:${email}:${type}`;
    const rateLimitCount = await redisClient.get(rateLimitKey);

    if (rateLimitCount && parseInt(rateLimitCount, 10) >= 3) {
        throw new BadRequestError('Too many resend attempts. Please wait before trying again.');
    }

    if (type === CredentialsType.EMAIL) {
        // Check if there's an active OTP session for email
        const emailOtpKey = `otp:email-otp:signup:${email}`;
        const existingOtp = await redisClient.get(emailOtpKey);

        if (!existingOtp) {
            throw new BadRequestError('No active OTP session found. Please request a new OTP.');
        }
        const userExists = await db.selectFrom('user').where('email', '=', email).executeTakeFirst();

        if (userExists) {
            throw new BadRequestError('Email already exists');
        }

        const emailOtp = new EmailOtpVerification(email, 'signup');
        await emailOtp.resendExistingOtp();

        await redisClient.incr(rateLimitKey);
        await redisClient.expire(rateLimitKey, 10 * 60); // 10 mins expiration
    } else if (type === CredentialsType.PHONE) {
        const { phone } = req.body;

        if (!phone) {
            throw new BadRequestError('Phone number is required');
        }

        const phoneOtpKey = `otp:phone-otp:signup:${email}:${phone}`;
        const existingOtp = await redisClient.get(phoneOtpKey);

        if (!existingOtp) {
            throw new BadRequestError('No active OTP session found. Please request a new OTP.');
        }

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

        const phoneOtp = new PhoneOtpVerification(email, 'signup', phone);
        await phoneOtp.resendExistingOtp();

        await redisClient.incr(rateLimitKey);
        await redisClient.expire(rateLimitKey, 10 * 60); // 10 mins expiration
    }

    res.status(OK).json({ message: 'OTP resent successfully' });
};

const verifyOtp = async (
    req: Request<undefined, ParamsDictionary, ResponseWithToken, VerifyOtpType>,
    res: Response<ResponseWithToken>,
) => {
    const { type, email, otp } = req.body;
    if (type === CredentialsType.EMAIL) {
        const emailOtp = new EmailOtpVerification(email, 'signup');
        await emailOtp.verifyOtp(otp);
        await redisClient.set(`email-verified:${email}`, 'true');
        await redisClient.expire(`email-verified:${email}`, 10 * 60);

        res.status(OK).json({ message: 'OTP verified' });
    } else if (type === CredentialsType.PHONE) {
        const { phone } = req.body;
        if (!(await redisClient.get(`email-verified:${email}`))) throw new UnauthorizedError('Email not verified.');

        const phoneOtp = new PhoneOtpVerification(email, 'signup', phone);
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
        const { pan_number, full_name, dob, masked_aadhaar } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
            .select(['pan_detail.pan_number', 'user_name.full_name', 'pan_detail.dob', 'pan_detail.masked_aadhaar'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        res.status(OK).json({ data: { pan_number, full_name, dob, masked_aadhaar }, message: 'PAN number fetched' });
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
        const { father_spouse_name, mother_name, maiden_name } = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('user_name as father_spouse', 'signup_checkpoints.father_spouse_name', 'father_spouse.id')
            .innerJoin('user_name as mother', 'signup_checkpoints.mother_name', 'mother.id')
            .leftJoin('user_name as maiden', 'signup_checkpoints.maiden_name', 'maiden.id')
            .select([
                'father_spouse.full_name as father_spouse_name',
                'mother.full_name as mother_name',
                'maiden.full_name as maiden_name',
            ])
            .where('email', '=', email)
            .where('father_spouse_name', 'is not', null)
            .where('mother_name', 'is not', null)
            .executeTakeFirstOrThrow();

        res.status(OK).json({
            data: { father_spouse_name, mother_name, maiden_name: maiden_name || null },
            message: 'User details fetched',
        });
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
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
            .select([
                'bank_account.account_no',
                'bank_account.ifsc_code',
                'bank_account.account_type',
                'user_name.full_name',
            ])
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
            const permanentAddressId = await insertAddressGetId(tx, {
                line_1: address.line_1,
                line_2: address.line_2,
                line_3: address.street_name,
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
                    address_id: permanentAddressId,
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
                permanent_address_id: permanentAddressId,
                correspondence_address_id: permanentAddressId,
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

        const checkpointData = await db
            .selectFrom('signup_checkpoints')
            .leftJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .select(['signup_checkpoints.id', 'pan_detail.masked_aadhaar'])
            .where('signup_checkpoints.email', '=', email)
            .executeTakeFirstOrThrow();

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
        const panDocument = documents.data.data.documents.find((d: any) => d.doc_type === 'PANCR');

        if (!aadhaar) throw new UnprocessableEntityError("User doesn't have aadhaar linked to his digilocker.");

        const downloadLink = await digilocker.downloadDocument(clientId, aadhaar.file_id);
        if (downloadLink.data.data.mime_type !== 'application/xml')
            throw new UnprocessableEntityError("Don't know how to process aadhaar file.");

        const file = await axios.get(downloadLink.data.data.download_url);
        const parser = new AadhaarXMLParser(file.data);
        parser.load();

        // PAN-verification-record
        let panDocumentData = null;

        if (panDocument) {
            try {
                logger.info(`Found PAN document in DigiLocker for user ${email}, downloading...`);

                const panDownloadLink = await digilocker.downloadDocument(clientId, panDocument.file_id);
                const panResponse = await axios.get(panDownloadLink.data.data.download_url, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: 50 * 1024 * 1024,
                });

                const panDocumentBuffer = Buffer.from(panResponse.data);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const sanitizedEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `pan_verification_${sanitizedEmail}_${timestamp}.pdf`;

                const panS3UploadResult = await s3Service.uploadFromBuffer(panDocumentBuffer, filename, {
                    folder: `pan-documents/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
                    contentType: panDownloadLink.data.data.mime_type,
                    metadata: {
                        'user-email': email,
                        'client-id': clientId,
                        'document-type': 'pan-verification-record',
                        source: 'digilocker',
                        'downloaded-date': new Date().toISOString(),
                        'file-size': panDocumentBuffer.length.toString(),
                        'original-name': panDocument.name,
                        issuer: panDocument.issuer || 'Income Tax Department',
                    },
                    cacheControl: 'private, max-age=31536000',
                });

                logger.info(`PAN document stored successfully: ${panS3UploadResult.key} for user: ${email}`);

                panDocumentData = {
                    s3_key: panS3UploadResult.key,
                    s3_url: panS3UploadResult.url,
                    filename: panDocument.name,
                    mime_type: panDownloadLink.data.data.mime_type,
                    file_size: panDocumentBuffer.length,
                    issuer: panDocument.issuer,
                };
            } catch (error: any) {
                logger.error(`Failed to download/store PAN document for user ${email}:`, error);
            }
        }

        // check for aadhar and PAN-aadhar mismatch
        const panAadhaarData = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .select('pan_detail.masked_aadhaar')
            .where('signup_checkpoints.email', '=', email)
            .executeTakeFirst();

        const digilockerMaskedAadhaar = parser.uid().substring(9, 12);
        const panMaskedAadhaar = panAadhaarData?.masked_aadhaar;

        if (panMaskedAadhaar && panMaskedAadhaar !== digilockerMaskedAadhaar) {
            const mismatchKey = `aadhaar_mismatch:${email}`;
            await redisClient.set(
                mismatchKey,
                JSON.stringify({
                    parser_data: {
                        uid: parser.uid(),
                        name: parser.name(),
                        dob: parser.dob(),
                        co: parser.co(),
                        address: parser.address(),
                        postOffice: parser.postOffice(),
                        gender: parser.gender(),
                    },
                    pan_masked_aadhaar: panMaskedAadhaar,
                    digilocker_masked_aadhaar: digilockerMaskedAadhaar,
                }),
            );
            await redisClient.expire(mismatchKey, 30 * 60);
            res.status(OK).json({
                message: 'Aadhaar verification requires additional details due to mismatch',
                data: {
                    requires_additional_verification: true,
                    pan_masked_aadhaar: `XXXXXXXX${panMaskedAadhaar}`,
                    digilocker_masked_aadhaar: `XXXXXXXX${digilockerMaskedAadhaar}`,
                    pan_document: panDocumentData?.s3_url || undefined,
                },
            });
            return;
        }

        await db.transaction().execute(async (tx) => {
            const address = parser.address();
            parser.log();
            const permanentAddressId = await insertAddressGetId(tx, {
                line_1: address.line_1 || null,
                line_2: address.line_2 || null,
                line_3: address.line_3 || null,
                city: address.city,
                state: address.state,
                country: address.country,
                postalCode: address.postalCode,
            });

            const nameId = await insertNameGetId(tx, splitName(parser.name()));

            let co = parser.co();
            let coId = null;
            if (co) {
                if (co.startsWith('C/O')) co = co.substring(4).trim();
                coId = await insertNameGetId(tx, splitName(co));
            }

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
                    address_id: permanentAddressId,
                    post_office: parser.postOffice() === undefined ? null : parser.postOffice(),
                    gender: parser.gender(),
                })
                .returning('id')
                .executeTakeFirstOrThrow();

            const checkpoint = await updateCheckpoint(tx, email, phone, {
                aadhaar_id: aadhaarId.id,
                permanent_address_id: permanentAddressId,
                correspondence_address_id: permanentAddressId,
                ...(panDocumentData
                    ? {
                          pan_document: panDocumentData.s3_url,
                          pan_document_issuer: panDocumentData.issuer,
                      }
                    : {}),
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({
                    aadhaar_status: 'pending',
                    address_status: 'pending',
                    pan_document_status: panDocumentData !== null ? 'verified' : undefined,
                })
                .where('id', '=', checkpoint.id)
                .execute();
        });

        res.status(OK).json({
            message: 'Aadhaar verified',
        });
    } else if (step === CheckpointStep.AADHAAR_MISMATCH_DETAILS) {
        const { full_name, dob } = req.body;
        const mismatchKey = `aadhaar_mismatch:${email}`;
        const mismatchData = await redisClient.get(mismatchKey);
        if (!mismatchData) {
            throw new UnauthorizedError(
                'Aadhaar mismatch data not found or expired. Restart the Digilocker session again.',
            );
        }

        const parsedMismatchData = JSON.parse(mismatchData);
        const parserData = parsedMismatchData.parser_data;

        let shouldSetDoubt = false;
        const bankData = await db
            .selectFrom('signup_checkpoints')
            .innerJoin('bank_to_checkpoint', 'signup_checkpoints.id', 'bank_to_checkpoint.checkpoint_id')
            .innerJoin('bank_account', 'bank_to_checkpoint.bank_account_id', 'bank_account.id')
            .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
            .select(['user_name.full_name as bank_verified_name'])
            .where('signup_checkpoints.email', '=', email)
            .executeTakeFirst();

        if (bankData && bankData.bank_verified_name) {
            const normalizedUserName = full_name.trim().toLowerCase().replace(/\s+/g, ' ');
            const normalizedBankName = bankData.bank_verified_name.trim().toLowerCase().replace(/\s+/g, ' ');

            if (normalizedUserName !== normalizedBankName) {
                shouldSetDoubt = true;
                logger.warn(
                    `Bank name mismatch for user ${email}: User provided: "${full_name}", Bank verified: "${bankData.bank_verified_name}"`,
                );
            } else {
                logger.info(`Bank name verification successful for user ${email}: Names match`);
            }
        } else {
            shouldSetDoubt = true;
            logger.warn(`No bank verification data found for user ${email}, setting doubt flag`);
        }

        await redisClient.del(mismatchKey);

        await db.transaction().execute(async (tx) => {
            const address = parserData.address;
            const permanentAddressId = await insertAddressGetId(tx, {
                line_1: address.line_1 || null,
                line_2: address.line_2 || null,
                line_3: address.line_3 || null,
                city: address.city,
                state: address.state,
                country: address.country,
                postalCode: address.postalCode,
            });

            const nameId = await insertNameGetId(tx, splitName(parserData.name));

            let co = parserData.co;
            let coId = null;
            if (co) {
                if (co.startsWith('C/O')) co = co.substring(4).trim();
                coId = await insertNameGetId(tx, splitName(co));
            }

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
                    masked_aadhaar_no: parserData.uid.substring(9, 12),
                    name: nameId,
                    dob: new Date(parserData.dob),
                    co: coId,
                    address_id: permanentAddressId,
                    post_office: parserData.postOffice === undefined ? null : parserData.postOffice,
                    gender: parserData.gender,
                })
                .returning('id')
                .executeTakeFirstOrThrow();
            const userProvidedNameId = await insertNameGetId(tx, splitName(full_name));

            const checkpoint = await updateCheckpoint(tx, email, phone, {
                aadhaar_id: aadhaarId.id,
                permanent_address_id: permanentAddressId,
                correspondence_address_id: permanentAddressId,
                doubt: shouldSetDoubt,
                user_provided_name: userProvidedNameId,
                user_provided_dob: new Date(dob),
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
        const responseMessage = shouldSetDoubt
            ? 'Aadhaar verification completed with manual review required due to name verification failure'
            : 'Aadhaar verification completed successfully';

        res.status(OK).json({
            message: responseMessage,
            data: {
                requires_manual_review: shouldSetDoubt,
            },
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

        const segmentsRequiringProof = segments.filter(
            (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
        );

        res.status(CREATED).json({
            message: 'Investment segment saved',
            data: {
                requiresIncomeProof: segmentsRequiringProof.length > 0,
                segmentsRequiringProof,
            },
        });
    } else if (step === CheckpointStep.USER_DETAIL) {
        const { father_spouse_name, mother_name, maiden_name } = req.body;

        await db.transaction().execute(async (tx) => {
            const fatherSpouseNameId = await insertNameGetId(tx, splitName(father_spouse_name));
            const motherNameId = await insertNameGetId(tx, splitName(mother_name));

            let maidenNameId = null;
            if (maiden_name && maiden_name.trim()) {
                maidenNameId = await insertNameGetId(tx, splitName(maiden_name.trim()));
            }

            await updateCheckpoint(tx, email, phone, {
                father_spouse_name: fatherSpouseNameId,
                mother_name: motherNameId,
                maiden_name: maidenNameId,
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
    } else if (step === CheckpointStep.INCOME_PROOF) {
        const uid = randomUUID();
        await redisClient.set(`signup_income_proof:${uid}`, email);
        await redisClient.expire(`signup_income_proof:${uid}`, 10 * 60);

        res.status(OK).json({
            data: { uid },
            message: 'Income proof upload started',
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
    } else if (step === CheckpointStep.ESIGN_INITIALIZE) {
        const { redirect_url, file_id } = req.body;

        const checkpointData = await db
            .selectFrom('signup_checkpoints')
            .leftJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
            .leftJoin('user_name', 'pan_detail.name', 'user_name.id')
            .select(['signup_checkpoints.id', 'user_name.full_name'])
            .where('signup_checkpoints.email', '=', email)
            .executeTakeFirstOrThrow();

        const esignResponse = await ESignService.initialize({
            file_id,
            pdf_pre_uploaded: true,
            callback_url: redirect_url,
            config: {
                accept_selfie: false,
                allow_selfie_upload: false,
                accept_virtual_sign: false,
                track_location: false,
                auth_mode: '1',
                reason: 'KYC-Document',
                positions: {
                    '1': [
                        {
                            x: 100,
                            y: 600,
                        },
                    ],
                },
            },
            prefill_options: {
                full_name: checkpointData.full_name || email.split('@')[0],
                mobile_number: phone,
                user_email: email,
            },
        });

        const key = `esign:${email}`;
        await redisClient.set(key, esignResponse.data.data.client_id);
        await redisClient.expire(key, 10 * 60);

        res.status(OK).json({
            data: {
                uri: esignResponse.data.data.url,
                client_id: esignResponse.data.data.client_id,
                token: esignResponse.data.data.token,
            },
            message: 'eSign session initialized',
        });
    } else if (step === CheckpointStep.ESIGN_COMPLETE) {
        const clientId = await redisClient.get(`esign:${email}`);
        if (!clientId) throw new UnauthorizedError('eSign not authorized or expired.');

        const statusResponse = await ESignService.getStatus(clientId);
        if (!statusResponse.data.data.completed) {
            throw new UnauthorizedError('eSign process not completed');
        }

        await redisClient.del(`esign:${email}`);

        const downloadResponse = await ESignService.downloadSignedDocument(clientId);

        let s3UploadResult = null;
        let pdfBuffer = null;

        try {
            logger.info(
                `Downloading eSign document for user ${email} from: ${downloadResponse.data.data.download_url}`,
            );

            const pdfResponse = await axios.get(downloadResponse.data.data.download_url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 50 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Terminal/1.0',
                    Accept: 'application/pdf, application/octet-stream, */*',
                },
            });

            // Convert to buffer
            pdfBuffer = Buffer.from(pdfResponse.data);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sanitizedEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `esign_${sanitizedEmail}_${timestamp}.pdf`;

            s3UploadResult = await s3Service.uploadFromBuffer(pdfBuffer, filename, {
                folder: `esign-documents/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
                contentType: 'application/pdf',
                metadata: {
                    'user-email': email,
                    'client-id': clientId,
                    'original-filename': downloadResponse.data.data.file_name,
                    'document-type': 'esign-kyc',
                    'signed-date': new Date().toISOString(),
                    'file-size': pdfBuffer.length.toString(),
                },
                cacheControl: 'private, max-age=31536000', // 1 year cache
            });
            logger.info(`eSign document successfully uploaded to S3: ${s3UploadResult.key} for user: ${email}`);
        } catch (error: any) {
            logger.error(`Failed to download/upload eSign document for user ${email}:`, error);

            if (error.response) {
                logger.error(`HTTP Error: ${error.response.status} - ${error.response.statusText}`);
            } else if (error.code) {
                logger.error(`Network Error: ${error.code} - ${error.message}`);
            }

            // Fail the eSign process if document storage fails
            throw new Error('Failed to store eSign document. Please try the eSign process again.');
        }

        // Only proceed if S3 upload was successful
        if (!s3UploadResult) {
            throw new Error('Failed to store eSign document. Please try again.');
        }
        await db.transaction().execute(async (tx) => {
            const checkpoint = await updateCheckpoint(tx, email, phone, {
                esign: s3UploadResult.url,
            })
                .returning('id')
                .executeTakeFirstOrThrow();

            await tx
                .updateTable('signup_verification_status')
                .set({
                    esign_status: 'verified',
                    updated_at: new Date(),
                })
                .where('id', '=', checkpoint.id)
                .execute();
        });
        const downloadUrl = s3Service.getPublicDownloadUrl(s3UploadResult.key);

        res.status(OK).json({
            message: 'eSign completed successfully',
            data: {
                document_stored: true,
                file_name: downloadResponse.data.data.file_name,
                storage_location: 's3',
                download_url: downloadUrl,
                signed_at: new Date().toISOString(),
            },
        });
    } else if (step === CheckpointStep.PASSWORD_SETUP) {
        const { password, confirm_password } = req.body;

        if (password !== confirm_password) {
            throw new BadRequestError('Passwords do not match');
        }
        const userCheckpoint = await db
            .selectFrom('signup_checkpoints')
            .select(['client_id', 'id'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        if (!userCheckpoint.client_id) {
            throw new ForbiddenError('Please complete KYC process first');
        }
        const existingPassword = await db
            .selectFrom('user_password_details')
            .select('user_id')
            .where('user_id', '=', userCheckpoint.client_id)
            .executeTakeFirst();

        if (existingPassword) {
            throw new BadRequestError('Password already set for this user');
        }

        const hashedPassword = await hashPassword(password, 'bcrypt');

        const hashAlgoRecord = await db
            .selectFrom('hashing_algorithm')
            .select('id')
            .where('name', '=', hashedPassword.hashAlgo)
            .executeTakeFirstOrThrow();

        await db.transaction().execute(async (tx) => {
            await tx
                .insertInto('user_password_details')
                .values({
                    user_id: userCheckpoint.client_id!,
                    password_hash: hashedPassword.hashedPassword,
                    password_salt: hashedPassword.salt,
                    hash_algo_id: hashAlgoRecord.id,
                })
                .execute();
        });

        res.status(CREATED).json({
            message: 'Password set successfully. Please set your MPIN.',
        });
    } else if (step === CheckpointStep.MPIN_SETUP) {
        const { mpin, confirm_mpin } = req.body;

        if (mpin !== confirm_mpin) {
            throw new BadRequestError('MPINs do not match');
        }

        const userCheckpoint = await db
            .selectFrom('signup_checkpoints')
            .select(['client_id', 'id'])
            .where('email', '=', email)
            .executeTakeFirstOrThrow();

        if (!userCheckpoint.client_id) {
            throw new ForbiddenError('Please complete signup process first');
        }

        const existingMpin = await db
            .selectFrom('user_mpin')
            .select('id')
            .where('client_id', '=', userCheckpoint.client_id)
            .executeTakeFirst();

        if (existingMpin) {
            throw new BadRequestError('MPIN already set for this user');
        }

        const hashedMpin = await hashPassword(mpin, 'bcrypt');

        const hashAlgoRecord = await db
            .selectFrom('hashing_algorithm')
            .select('id')
            .where('name', '=', hashedMpin.hashAlgo)
            .executeTakeFirstOrThrow();

        await db.transaction().execute(async (tx) => {
            if (!userCheckpoint.client_id) {
                throw new ForbiddenError('Please complete signup process first');
            }
            await tx
                .insertInto('user_mpin')
                .values({
                    client_id: userCheckpoint.client_id,
                    mpin_hash: hashedMpin.hashedPassword,
                    mpin_salt: hashedMpin.salt,
                    hash_algo_id: hashAlgoRecord.id,
                    created_at: new Date(),
                    updated_at: new Date(),
                    is_active: true,
                    failed_attempts: 0,
                })
                .execute();
        });

        res.status(CREATED).json({
            message: 'MPIN set successfully',
        });
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

const pdfUploadHandler = wrappedMulterHandler(pdfUpload.single('pdf'));
const putIncomeProof = async (req: Request<JwtType, UIDParams>, res: Response) => {
    const { uid } = req.params;
    const { email, phone } = req.auth!;

    const value = await redisClient.get(`signup_income_proof:${uid}`);
    if (!value || value !== email) {
        throw new UnauthorizedError('Income proof upload not authorized or expired.');
    }
    let uploadResult;
    try {
        uploadResult = await pdfUploadHandler(req, res);
    } catch (e: any) {
        throw new UnprocessableEntityError(e.message);
    }

    await db.transaction().execute(async (tx) => {
        const checkpoint = await updateCheckpoint(tx, email, phone, {
            income_proof: uploadResult.file.location,
        })
            .returning('id')
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('signup_verification_status')
            .set({
                income_proof_status: 'pending',
                updated_at: new Date(),
            })
            .where('id', '=', checkpoint.id)
            .execute();
    });

    const userDetails = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
        .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
        .select(['user_name.first_name'])
        .where('signup_checkpoints.email', '=', email)
        .executeTakeFirst();

    if (userDetails) {
        // Send documents received confirmation email
        await sendDocumentsReceivedConfirmation(email, {
            userName: userDetails.first_name,
            email,
        });

        logger.info(`Documents received confirmation email sent to ${email}`);
    }

    await redisClient.del(`signup_income_proof:${uid}`);
    res.status(CREATED).json({
        message: 'Income proof uploaded successfully',
    });
};

const getIncomeProof = async (req: Request<JwtType>, res: Response) => {
    const { email } = req.auth!;

    const { income_proof: url } = await db
        .selectFrom('signup_checkpoints')
        .select('income_proof')
        .where('email', '=', email)
        .executeTakeFirstOrThrow();

    if (url === null) {
        res.status(NO_CONTENT).json({ message: 'Income proof not uploaded' });
    } else {
        res.status(OK).json({
            data: { url },
            message: 'Income proof uploaded.',
        });
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

    // return first Name
    const userData = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
        .innerJoin('user_name', 'pan_detail.name', 'user_name.id')
        .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
        .select(['user_name.first_name', 'phone_number.phone'])
        .where('signup_checkpoints.email', '=', email)
        .executeTakeFirstOrThrow();

    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('signup_checkpoints')
            .set({
                client_id: id,
            })
            .where('email', '=', email)
            .execute();
    });

    try {
        if (userData.phone) {
            await smsService.sendTemplatedSms(userData.phone, SmsTemplateType.ACCOUNT_SUCCESSFULLY_OPENED, [
                userData.first_name,
            ]);
            logger.info(`Account successfully opened SMS sent to ${userData.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send account successfully opened SMS: ${error}`);
    }

    res.status(CREATED).json({
        message: 'Sign up successfully.',
        data: {
            clientId: id,
            firstName: userData.first_name,
        },
    });
};

export {
    requestOtp,
    resendOtp,
    verifyOtp,
    postCheckpoint,
    getCheckpoint,
    putIpv,
    getIpv,
    putSignature,
    getSignature,
    putIncomeProof,
    getIncomeProof,
    finalizeSignup,
};
