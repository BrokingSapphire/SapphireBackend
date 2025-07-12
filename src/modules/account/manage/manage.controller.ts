import { Response } from 'express';
import { Request } from '@app/types.d';
import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types.d';
import { OK } from '@app/utils/httpstatus';
import { SessionJwtType } from '@app/modules/common.types';
import { db } from '@app/database';
import { BadRequestError, UnauthorizedError, UnprocessableEntityError } from '@app/apiError';
import { pdfUpload, wrappedMulterHandler } from '@app/services/multer-s3.service';
import {
    DematAction,
    DematStatus,
    FundsSettlementFrequency,
    AddBankAccountRequest,
    RemoveBankRequest,
    SegmentActivationSettings,
    VerifyDematFreezeOtpType,
    InitiateDematFreezeRequest,
    ResendDematFreezeOtpType,
    ResendSegmentActivationOtpType,
    VerifySegmentActivationOtpType,
    IncomeProofStatus,
} from './manage.types';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '@app/services/otp.service';
import SRNGenerator from '@app/services/srn-generator';
import { randomUUID } from 'crypto';
import { UIDParams } from '@app/modules/signup/signup.types';
import { IncomeProofTypeEnum } from '@app/database/db';
import { IFSCService } from '@app/services/razorpay/ifsc.service';
import { SmsTemplateType } from '@app/services/notifications-types/sms.types';
import logger from '@app/logger';
import smsService from '@app/services/sms.service';

const getIncomeProofStatus = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;

    // Check current segments
    const activeSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const activeSegmentNames = activeSegments.map((s) => s.segment);
    const requiresIncomeProof = activeSegmentNames.some(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    const segmentsRequiringProof = activeSegmentNames.filter(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    let incomeProofStatus: IncomeProofStatus = {
        hasIncomeProof: false,
        incomeProofType: null,
        incomeProofUrl: null,
        canProceed: true,
    };

    if (requiresIncomeProof) {
        // Check user table for existing income proof
        const userData = await db
            .selectFrom('user')
            .select(['income_proof', 'income_proof_type'])
            .where('id', '=', userId)
            .executeTakeFirst();

        incomeProofStatus = {
            hasIncomeProof: !!userData?.income_proof,
            incomeProofType: userData?.income_proof_type || null,
            incomeProofUrl: userData?.income_proof || null,
            canProceed: !!userData?.income_proof,
        };
    }

    res.status(OK).json({
        message: 'Income proof status retrieved successfully',
        data: {
            requiresIncomeProof,
            segmentsRequiringProof,
            activeSegments: activeSegmentNames,
            incomeProofStatus,
        },
    });
};

const initiateIncomeProofUpload = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, { income_proof_type: string }>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { income_proof_type } = req.body;

    // Check if user has segments that require income proof
    const activeSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const activeSegmentNames = activeSegments.map((s) => s.segment);
    const requiresIncomeProof = activeSegmentNames.some(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    if (!requiresIncomeProof) {
        throw new BadRequestError('Income proof not required for your current segments');
    }

    // Update income proof type in user table
    await db
        .updateTable('user')
        .set({
            income_proof_type: income_proof_type as IncomeProofTypeEnum,
            updated_at: new Date(),
        })
        .where('id', '=', userId)
        .execute();

    const uid = randomUUID();
    await redisClient.set(`manage_income_proof:${uid}`, userId.toString());
    await redisClient.expire(`manage_income_proof:${uid}`, 10 * 60);

    res.status(OK).json({
        data: { uid, income_proof_type },
        message: 'Income proof upload initiated',
    });
};

const putIncomeProof = async (
    req: Request<SessionJwtType, UIDParams, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { uid } = req.params;
    const { userId } = req.auth!;

    const storedUserId = await redisClient.get(`manage_income_proof:${uid}`);
    if (!storedUserId || storedUserId !== userId.toString()) {
        throw new UnauthorizedError('Income proof upload not authorized or expired.');
    }
    const pdfUploadHandler = wrappedMulterHandler(pdfUpload.single('pdf'));

    let uploadResult;
    try {
        uploadResult = await pdfUploadHandler(req, res);
    } catch (e: any) {
        throw new UnprocessableEntityError(e.message);
    }

    // Update income proof in user table
    await db
        .updateTable('user')
        .set({
            income_proof: uploadResult.file.location,
            updated_at: new Date(),
        })
        .where('id', '=', userId)
        .execute();

    await redisClient.del(`manage_income_proof:${uid}`);

    res.status(OK).json({
        message: 'Income proof uploaded successfully. Segment activation completed.',
        data: {
            url: uploadResult.file.location,
            status: 'completed',
        },
    });
};

const getCurrentSegments = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;

    // Get currently active segments for the user
    const activeSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const activeSegmentNames = activeSegments.map((s) => s.segment);

    // Format response to match the UI expectations
    const segmentStatus = {
        cashMutualFunds: activeSegmentNames.includes('Cash'),
        futuresAndOptions: activeSegmentNames.includes('F&O'),
        commodityDerivatives: activeSegmentNames.includes('Commodity'),
        debt: activeSegmentNames.includes('Debt'),
        currency: activeSegmentNames.includes('Currency'),
    };

    // Check if income proof is required based on current segments
    const requiresIncomeProof = activeSegmentNames.some(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    const segmentsRequiringProof = activeSegmentNames.filter(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    res.status(OK).json({
        message: 'Current segment activation status retrieved successfully',
        data: {
            segments: segmentStatus,
            activeSegments: activeSegmentNames,
            requiresIncomeProof,
            segmentsRequiringProof,
            totalActiveSegments: activeSegmentNames.length,
        },
    });
};
const updateSegmentActivation = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, SegmentActivationSettings>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { cashMutualFunds, futuresAndOptions, commodityDerivatives, debt, currency } = req.body;

    // Get user email for OTP
    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.email', 'phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Get currently active segments
    const currentSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const currentSegmentNames = currentSegments.map((s) => s.segment);

    // Check if there are any changes to segments
    const requestedSegments = [
        { name: 'Cash', isActive: cashMutualFunds },
        { name: 'F&O', isActive: futuresAndOptions },
        { name: 'Commodity', isActive: commodityDerivatives },
        { name: 'Debt', isActive: debt },
        { name: 'Currency', isActive: currency },
    ].filter((segment) => segment.isActive !== undefined);

    // Check for any changes (activations or deactivations)
    const hasChanges = requestedSegments.some(({ name, isActive }) => {
        const segmentExists = currentSegmentNames.includes(name as any);
        return (isActive && !segmentExists) || (!isActive && segmentExists);
    });

    // If no changes are being made, return early
    if (!hasChanges) {
        res.status(OK).json({
            message: 'No changes detected in segment activation',
            data: {
                requiresOtpVerification: false,
                currentSegments: currentSegmentNames,
            },
        });
        return;
    }

    // Generate session ID for OTP verification
    const sessionId = randomUUID();

    // Store session data in Redis
    const sessionData = {
        userId,
        email: user.email,
        segmentSettings: req.body,
        isUsed: false,
        timestamp: new Date().toISOString(),
    };

    const redisKey = `segment_activation_otp:${sessionId}`;
    await redisClient.set(redisKey, JSON.stringify(sessionData));
    await redisClient.expire(redisKey, 10 * 60); // 10 minutes expiry

    // Send OTP immediately
    const emailOtp = new EmailOtpVerification(user.email, 'segment-activation');
    await emailOtp.sendOtp();

    const otpKey = `otp:email-otp:segment-activation:${user.email}`;
    const otp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.SEGMENT_MODIFICATION_OTP, [otp]);
            logger.info(`Segment activation OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send segment activation OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent to your registered email address and phone number. Please verify to update segments.',
        data: {
            sessionId,
            requiresOtpVerification: true,
        },
    });
};

// Step 2: Verify OTP and update segment activation
const verifySegmentActivationOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, VerifySegmentActivationOtpType>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId, otp } = req.body;

    const srnGenerator = new SRNGenerator('RMS');
    const srn = srnGenerator.generateTimestampSRN();

    // Verify session
    const redisKey = `segment_activation_otp:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Segment activation session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Segment activation session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid segment activation session');
    }

    // Verify OTP
    const emailOtp = new EmailOtpVerification(session.email, 'segment-activation');
    await emailOtp.verifyOtp(otp);

    // Mark session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    // Get current segments
    const currentSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const currentSegmentNames = currentSegments.map((s) => s.segment);

    // Update segments based on session data
    const { cashMutualFunds, futuresAndOptions, commodityDerivatives, debt, currency } = session.segmentSettings;

    await db.transaction().execute(async (tx) => {
        const segmentUpdates = [
            { name: 'Cash', isActive: cashMutualFunds },
            { name: 'F&O', isActive: futuresAndOptions },
            { name: 'Commodity', isActive: commodityDerivatives },
            { name: 'Debt', isActive: debt },
            { name: 'Currency', isActive: currency },
        ].filter((segment) => segment.isActive !== undefined);

        for (const { name, isActive } of segmentUpdates) {
            const segmentExists = currentSegmentNames.includes(name as any);

            if (isActive && !segmentExists) {
                await tx
                    .insertInto('investment_segments_to_user')
                    .values({ user_id: userId, segment: name as any })
                    .execute();
            } else if (!isActive && segmentExists) {
                await tx
                    .deleteFrom('investment_segments_to_user')
                    .where('user_id', '=', userId)
                    .where('segment', '=', name as any)
                    .execute();
            }
        }
    });

    // Clean up Redis session
    await redisClient.del(redisKey);

    // Get final segments
    const finalSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const finalSegmentNames = finalSegments.map((s) => s.segment);

    const requiresIncomeProof = finalSegmentNames.some(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    const segmentsRequiringProof = finalSegmentNames.filter(
        (segment: string) => segment === 'Currency' || segment === 'Commodity' || segment === 'F&O',
    );

    // Check current income proof status
    let incomeProofStatus: IncomeProofStatus = {
        hasIncomeProof: false,
        incomeProofType: null,
        incomeProofUrl: null,
        canProceed: true,
    };

    if (requiresIncomeProof) {
        const user = await db
            .selectFrom('user')
            .select(['income_proof', 'income_proof_type'])
            .where('id', '=', userId)
            .executeTakeFirst();

        incomeProofStatus = {
            hasIncomeProof: !!user?.income_proof,
            incomeProofType: user?.income_proof_type || null,
            incomeProofUrl: user?.income_proof || null,
            canProceed: !!user?.income_proof,
        };
    }

    res.status(OK).json({
        message: incomeProofStatus.canProceed
            ? 'Segment activation updated successfully'
            : 'Segments activated. Please upload income proof to complete the process.',
        data: {
            ...session.segmentSettings,
            requiresIncomeProof,
            segmentsRequiringProof,
            srn,
            generatedAt: new Date().toISOString(),
            activatedSegments: finalSegmentNames,
            incomeProofStatus,
            nextStep: incomeProofStatus.canProceed ? 'completed' : 'upload_income_proof',
        },
    });
};

// Step 3: Resend OTP for segment activation
const resendSegmentActivationOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, ResendSegmentActivationOtpType>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId } = req.body;

    // Check rate limiting
    const rateLimitKey = `resend-segment-activation-otp-limit:${userId}`;
    const rateLimitCount = await redisClient.get(rateLimitKey);

    if (rateLimitCount && parseInt(rateLimitCount, 10) >= 3) {
        throw new BadRequestError('Too many resend attempts. Please wait before trying again.');
    }

    // Verify session exists and is valid
    const redisKey = `segment_activation_otp:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Segment activation session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Segment activation session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid segment activation session');
    }

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirst();

    // Resend OTP
    const emailOtp = new EmailOtpVerification(session.email, 'segment-activation');
    await emailOtp.resendExistingOtp();

    // Get the existing OTP for SMS
    const otpKey = `otp:email-otp:segment-activation:${session.email}`;
    const existingOtp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user && user.phone && existingOtp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.SEGMENT_MODIFICATION_OTP, [existingOtp]);
            logger.info(`Segment activation OTP SMS resent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to resend segment activation OTP SMS: ${error}`);
    }

    // Update rate limit
    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 10 * 60); // 10 minutes expiration

    res.status(OK).json({
        message: 'OTP resent successfully to your registered email address and phone number',
        data: {
            sessionId,
        },
    });
};

const getBankAccounts = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;

    const bankAccounts = await db
        .selectFrom('bank_to_user')
        .innerJoin('bank_account', 'bank_to_user.bank_account_id', 'bank_account.id')
        .select([
            'bank_account.id',
            'bank_account.account_no',
            'bank_account.ifsc_code',
            'bank_account.account_type',
            'bank_account.verification',
            'bank_account.account_holder_name',
            'bank_account.bank_name',
            'bank_account.branch_name',
            'bank_account.created_at',
            'bank_account.updated_at',
            'bank_to_user.is_primary',
        ])
        .where('bank_to_user.user_id', '=', userId)
        .orderBy('bank_to_user.is_primary', 'desc')
        .orderBy('bank_account.created_at', 'desc')
        .execute();

    res.status(OK).json({
        message: 'Bank accounts retrieved successfully',
        data: bankAccounts,
    });
};

const addBankAccount = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, AddBankAccountRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { account_no, ifsc_code, account_type } = req.body;

    const ifscService = new IFSCService();
    let ifscResponse;

    try {
        ifscResponse = await ifscService.lookup(ifsc_code.toUpperCase());

        if (ifscResponse.status === 404) {
            throw new UnprocessableEntityError('Invalid IFSC code');
        }
    } catch (error) {
        throw new UnprocessableEntityError('Unable to validate IFSC code. Please check and try again.');
    }

    const srnGenerator = new SRNGenerator('ACC');
    const srn = srnGenerator.generateTimestampSRN();

    const existingAccount = await db
        .selectFrom('bank_account')
        .select(['id'])
        .where('account_no', '=', account_no)
        .where('ifsc_code', '=', ifsc_code.toUpperCase())
        .executeTakeFirst();

    if (existingAccount) {
        const userAccountLink = await db
            .selectFrom('bank_to_user')
            .select(['bank_account_id'])
            .where('user_id', '=', userId)
            .where('bank_account_id', '=', existingAccount.id)
            .executeTakeFirst();

        if (userAccountLink) {
            throw new BadRequestError('This bank account is already added to your account');
        }
    }
    await db.transaction().execute(async (tx) => {
        let bankAccountId;

        if (existingAccount) {
            await tx
                .updateTable('bank_account')
                .set({
                    bank_name: ifscResponse.data.BANK,
                    branch_name: ifscResponse.data.BRANCH,
                    updated_at: new Date(),
                })
                .where('id', '=', existingAccount.id)
                .where('bank_name', 'is', null)
                .execute();

            bankAccountId = existingAccount.id;
        } else {
            // Create new bank account
            const newBankAccount = await tx
                .insertInto('bank_account')
                .values({
                    account_no,
                    ifsc_code,
                    account_type,
                    verification: 'pending',
                    bank_name: ifscResponse.data.BANK,
                    branch_name: ifscResponse.data.BRANCH,
                })
                .returning('id')
                .executeTakeFirstOrThrow();

            bankAccountId = newBankAccount.id;
        }

        // Link bank account to user
        await tx
            .insertInto('bank_to_user')
            .values({
                user_id: userId,
                bank_account_id: bankAccountId,
            })
            .execute();
    });

    res.status(OK).json({
        message: 'Bank account added successfully',
        data: {
            accountNumber: account_no,
            ifscCode: ifsc_code.toUpperCase(),
            accountType: account_type,
            bankName: ifscResponse.data.BANK,
            branchName: ifscResponse.data.BRANCH,
            bankDetails: {
                fullBankName: ifscResponse.data.BANK,
                fullBranchName: ifscResponse.data.BRANCH,
                city: ifscResponse.data.CITY,
                state: ifscResponse.data.STATE,
                district: ifscResponse.data.DISTRICT,
            },
            verification: 'pending',
            srn,
            generatedAt: new Date().toISOString(),
        },
    });
};

const removeBankAccount = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, RemoveBankRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { bankAccountId } = req.body;

    const srnGenerator = new SRNGenerator('ACC');
    const srn = srnGenerator.generateTimestampSRN();

    const bankAccount = await db
        .selectFrom('bank_to_user')
        .innerJoin('bank_account', 'bank_to_user.bank_account_id', 'bank_account.id')
        .select([
            'bank_account.id',
            'bank_account.account_no',
            'bank_account.ifsc_code',
            'bank_account.bank_name',
            'bank_account.branch_name',
            'bank_account.account_type',
            'bank_account.verification',
            'bank_to_user.is_primary',
        ])
        .where('bank_to_user.user_id', '=', userId)
        .where('bank_account.id', '=', bankAccountId)
        .executeTakeFirst();

    if (!bankAccount) {
        throw new BadRequestError('Bank account not found or does not belong to this user');
    }

    if (bankAccount.is_primary) {
        throw new BadRequestError(
            'Cannot remove your primary bank account. This is the account used during signup and is required for compliance purposes. You can only add additional accounts, but the primary account must remain active.',
        );
    }

    // check for any pending transactions
    const hasActiveTransactions = await db
        .selectFrom('balance_transactions')
        .select('transaction_id')
        .where('user_id', '=', userId)
        .where('bank_id', '=', bankAccountId)
        .where('status', 'in', ['pending'])
        .executeTakeFirst();

    if (hasActiveTransactions) {
        throw new BadRequestError(
            'Cannot remove bank account with pending transactions. Please wait for all transactions to complete.',
        );
    }

    await db
        .deleteFrom('bank_to_user')
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bankAccountId)
        .execute();

    res.status(OK).json({
        message: 'Bank account removed successfully',
        data: {
            bankAccountId,
            srn,
            generatedAt: new Date().toISOString(),
        },
    });
};

//     /*
//     Later On need to add more checks like
//     - If the user has any active orders, they cannot freeze the demat account
//     - If the user has any active holdings, they cannot freeze the demat account
//     - If the user has any active mutual funds, they cannot freeze the demat account
//     - If the user has any active loans, they cannot freeze the demat account

//     All things needs to be 0 i number to freeze the demat account
//     */

const initiateDematFreeze = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, InitiateDematFreezeRequest>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { action, reason } = req.body;

    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.email', 'phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Validate current demat status
    let currentDematStatus = await db
        .selectFrom('user_demat_status')
        .select(['demat_status'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    if (!currentDematStatus) {
        await db
            .insertInto('user_demat_status')
            .values({
                user_id: userId,
                demat_status: DematStatus.ACTIVE,
                freeze_until: null,
            })
            .execute();
        currentDematStatus = { demat_status: DematStatus.ACTIVE };
    }

    if (action === DematAction.FREEZE && currentDematStatus.demat_status === DematStatus.FROZEN) {
        throw new BadRequestError('Demat account is already frozen');
    }

    if (action === DematAction.UNFREEZE && currentDematStatus.demat_status !== DematStatus.FROZEN) {
        throw new BadRequestError('Demat account is not frozen');
    }

    // Generate session ID
    const sessionId = require('crypto').randomUUID();

    // Store session data in Redis
    const sessionData = {
        userId,
        email: user.email,
        action,
        reason: reason || null,
        isUsed: false,
        timestamp: new Date().toISOString(),
    };

    const redisKey = `demat_freeze_otp:${sessionId}`;
    await redisClient.set(redisKey, JSON.stringify(sessionData));
    await redisClient.expire(redisKey, 10 * 60); // 10 minutes expiry

    // Send OTP immediately
    const emailOtp = new EmailOtpVerification(user.email, 'demat-freeze');
    await emailOtp.sendOtp();

    // Get the OTP from Redis to send via SMS
    const otpKey = `otp:email-otp:demat-freeze:${user.email}`;
    const otp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.DEMAT_ACCOUNT_FREEZE_OTP, [otp]);
            logger.info(`Demat freeze OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send demat freeze OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent to your registered email address and phone number. Please verify to proceed.',
        data: {
            sessionId,
            action,
            reason,
        },
    });
};

// Step 2: Resend OTP for demat freeze
const resendDematFreezeOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, ResendDematFreezeOtpType>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId } = req.body;

    // Check rate limiting
    const rateLimitKey = `resend-demat-freeze-otp-limit:${userId}`;
    const rateLimitCount = await redisClient.get(rateLimitKey);

    if (rateLimitCount && parseInt(rateLimitCount, 10) >= 3) {
        throw new BadRequestError('Too many resend attempts. Please wait before trying again.');
    }

    // Verify session exists and is valid
    const redisKey = `demat_freeze_otp:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Demat freeze session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Demat freeze session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid demat freeze session');
    }

    // Get user phone number
    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirst();

    // resend OTP
    const emailOtp = new EmailOtpVerification(session.email, 'demat-freeze');
    await emailOtp.resendExistingOtp();

    // Get the OTP from Redis to send via SMS
    const otpKey = `otp:email-otp:demat-freeze:${session.email}`;
    const existingOtp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user && user.phone && existingOtp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.DEMAT_ACCOUNT_FREEZE_OTP, [existingOtp]);
            logger.info(`Demat freeze OTP SMS resent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to resend demat freeze OTP SMS: ${error}`);
    }

    // Update rate limit
    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 10 * 60); // 10 minutes expiration

    res.status(OK).json({
        message: 'OTP resent successfully to your registered email address and phone number',
        data: {
            sessionId,
            action: session.action,
        },
    });
};

// Step 2: Verify OTP and execute freeze/unfreeze
const verifyDematFreezeOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, VerifyDematFreezeOtpType>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId, otp } = req.body;

    const srnGenerator = new SRNGenerator('RMS');
    const srn = srnGenerator.generateTimestampSRN();

    // Verify session
    const redisKey = `demat_freeze_otp:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Demat freeze session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Demat freeze session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid demat freeze session');
    }

    // Verify OTP
    const emailOtp = new EmailOtpVerification(session.email, 'demat-freeze');
    await emailOtp.verifyOtp(otp);

    // Mark session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    // Get current demat status
    let currentDematStatus = await db
        .selectFrom('user_demat_status')
        .select(['demat_status', 'freeze_until'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    if (!currentDematStatus) {
        await db
            .insertInto('user_demat_status')
            .values({
                user_id: userId,
                demat_status: DematStatus.ACTIVE,
                freeze_until: null,
            })
            .execute();
        currentDematStatus = { demat_status: DematStatus.ACTIVE, freeze_until: null };
    }

    const newStatus = session.action === DematAction.FREEZE ? DematStatus.FROZEN : DematStatus.ACTIVE;
    const currentTime = new Date();
    const freezeUntil =
        session.action === DematAction.FREEZE ? new Date(currentTime.getTime() + 48 * 60 * 60 * 1000) : null;

    await db.transaction().execute(async (tx) => {
        // Update user demat status
        await tx
            .updateTable('user_demat_status')
            .set({
                demat_status: newStatus,
                freeze_until: freezeUntil,
                updated_at: currentTime,
            })
            .where('user_id', '=', userId)
            .execute();

        if (session.action === DematAction.FREEZE) {
            // Logout from all devices - deactivate all sessions
            await tx
                .updateTable('user_sessions')
                .set({
                    is_active: false,
                    session_end: currentTime,
                })
                .where('user_id', '=', userId)
                .where('is_active', '=', true)
                .execute();
        }

        // Log the freeze/unfreeze action
        await tx
            .insertInto('demat_freeze_log')
            .values({
                user_id: userId,
                action: session.action,
                reason: session.reason,
                previous_status: currentDematStatus.demat_status,
                new_status: newStatus,
                freeze_until: freezeUntil,
            })
            .execute();
    });

    // Clean up Redis session
    await redisClient.del(redisKey);

    if (session.action === DematAction.FREEZE) {
        res.status(OK).json({
            message:
                'Demat account frozen successfully. You will be logged out from all devices and cannot login for 48 hours.',
            data: {
                action: session.action,
                status: newStatus,
                srn,
                reason: session.reason,
                freezeUntil,
            },
        });
    } else {
        res.status(OK).json({
            message: 'Demat account unfrozen successfully. You can now login normally.',
            data: {
                action: session.action,
                status: newStatus,
                srn,
            },
        });
    }
};

const getSettlementFrequency = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, undefined>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;

    const userFrequency = await db
        .selectFrom('user_settlement_frequency')
        .select(['settlement_frequency', 'updated_at'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    // Default to bill_to_bill if no record exists
    const currentFrequency = userFrequency?.settlement_frequency || FundsSettlementFrequency.BILL_TO_BILL;
    const lastUpdated = userFrequency?.updated_at || null;

    res.status(OK).json({
        message: 'Settlement frequency retrieved successfully',
        data: {
            currentFrequency,
            lastUpdated,
            availableOptions: [
                { value: FundsSettlementFrequency.THIRTY_DAYS, label: '30 Days' },
                { value: FundsSettlementFrequency.NINETY_DAYS, label: '90 Days' },
                { value: FundsSettlementFrequency.BILL_TO_BILL, label: 'Bill to Bill' },
            ],
        },
    });
};

const updateSettlementFrequency = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, { frequency: FundsSettlementFrequency }>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { frequency } = req.body;

    // Get user email and phone for OTP
    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['user.email', 'phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Generate session ID for OTP verification
    const sessionId = randomUUID();

    // Store session data in Redis
    const sessionData = {
        userId,
        email: user.email,
        frequency,
        isUsed: false,
        timestamp: new Date().toISOString(),
    };

    const redisKey = `settlement_frequency_change:${sessionId}`;
    await redisClient.set(redisKey, JSON.stringify(sessionData));
    await redisClient.expire(redisKey, 10 * 60); // 10 minutes expiry

    // Send OTP immediately
    const emailOtp = new EmailOtpVerification(user.email, 'settlement-frequency-change');
    await emailOtp.sendOtp();

    // Get the OTP from Redis to send via SMS
    const otpKey = `otp:email-otp:settlement-frequency-change:${user.email}`;
    const otp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user.phone && otp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.RUNNING_ACCOUNT_SETTLEMENT_OTP, [otp]);
            logger.info(`Settlement frequency change OTP SMS sent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to send settlement frequency change OTP SMS: ${error}`);
    }

    res.status(OK).json({
        message: 'OTP sent to your registered email address and phone number. Please verify to complete the change.',
        data: {
            sessionId,
            newFrequency: frequency,
        },
    });
};

const verifySettlementFrequencyOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, { sessionId: string; otp: string }>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId, otp } = req.body;

    const srnGenerator = new SRNGenerator('ACC');
    const srn = srnGenerator.generateTimestampSRN();

    const redisKey = `settlement_frequency_change:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Settlement frequency change session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Settlement frequency change session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid settlement frequency change session');
    }

    // Verify OTP
    const emailOtp = new EmailOtpVerification(session.email, 'settlement-frequency-change');
    await emailOtp.verifyOtp(otp);

    // Mark session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    const existingRecord = await db
        .selectFrom('user_settlement_frequency')
        .select(['user_id'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    const currentTime = new Date();

    if (!existingRecord) {
        await db
            .insertInto('user_settlement_frequency')
            .values({
                user_id: userId,
                settlement_frequency: session.frequency,
                created_at: currentTime,
                updated_at: currentTime,
            })
            .execute();
    } else {
        await db
            .updateTable('user_settlement_frequency')
            .set({
                settlement_frequency: session.frequency,
                updated_at: currentTime,
            })
            .where('user_id', '=', userId)
            .execute();
    }

    // Clean up Redis session
    await redisClient.del(redisKey);

    let frequencyMessage;
    if (session.frequency === FundsSettlementFrequency.THIRTY_DAYS) {
        frequencyMessage = 'Settlement frequency updated to 30 days successfully';
    } else if (session.frequency === FundsSettlementFrequency.NINETY_DAYS) {
        frequencyMessage = 'Settlement frequency updated to 90 days successfully';
    } else {
        frequencyMessage = 'Settlement frequency updated to Bill to Bill successfully';
    }

    res.status(OK).json({
        message: frequencyMessage,
        data: {
            settlementFrequency: session.frequency,
            updatedAt: currentTime,
            srn,
        },
    });
};

const resendSettlementFrequencyOtp = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, { sessionId: string }>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId } = req.body;

    // Check rate limiting
    const rateLimitKey = `resend-settlement-frequency-otp-limit:${userId}`;
    const rateLimitCount = await redisClient.get(rateLimitKey);

    if (rateLimitCount && parseInt(rateLimitCount, 10) >= 3) {
        throw new BadRequestError('Too many resend attempts. Please wait before trying again.');
    }

    const redisKey = `settlement_frequency_change:${sessionId}`;
    const sessionStr = await redisClient.get(redisKey);

    if (!sessionStr) {
        throw new UnauthorizedError('Settlement frequency change session expired or invalid');
    }

    const session = JSON.parse(sessionStr);

    if (session.isUsed) {
        throw new UnauthorizedError('Settlement frequency change session already used');
    }

    if (session.userId !== userId) {
        throw new UnauthorizedError('Invalid settlement frequency change session');
    }

    // Get user phone number
    const user = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .select(['phone_number.phone'])
        .where('user.id', '=', userId)
        .executeTakeFirst();

    const emailOtp = new EmailOtpVerification(session.email, 'settlement-frequency-change');
    await emailOtp.resendExistingOtp();

    // Get the existing OTP for SMS
    const otpKey = `otp:email-otp:settlement-frequency-change:${session.email}`;
    const existingOtp = await redisClient.get(otpKey);

    // Send SMS OTP
    try {
        if (user && user.phone && existingOtp) {
            await smsService.sendTemplatedSms(user.phone, SmsTemplateType.RUNNING_ACCOUNT_SETTLEMENT_OTP, [
                existingOtp,
            ]);
            logger.info(`Settlement frequency change OTP SMS resent to ${user.phone}`);
        }
    } catch (error) {
        logger.error(`Failed to resend settlement frequency change OTP SMS: ${error}`);
    }

    // Update rate limit
    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 10 * 60);

    res.status(OK).json({
        message: 'OTP resent successfully to your registered email address and phone number',
        data: {
            sessionId,
        },
    });
};

export {
    updateSegmentActivation,
    verifySegmentActivationOtp,
    resendSegmentActivationOtp,
    getBankAccounts,
    addBankAccount,
    removeBankAccount,
    initiateDematFreeze,
    resendDematFreezeOtp,
    verifyDematFreezeOtp,
    getCurrentSegments,
    getIncomeProofStatus,
    initiateIncomeProofUpload,
    putIncomeProof,
    getSettlementFrequency,
    updateSettlementFrequency,
    verifySettlementFrequencyOtp,
    resendSettlementFrequencyOtp,
};
