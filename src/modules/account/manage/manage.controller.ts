import { Response } from 'express';
import { Request } from '@app/types.d';
import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types.d';
import { OK } from '@app/utils/httpstatus';
import { SessionJwtType } from '@app/modules/common.types';
import { db } from '@app/database';
import { BadRequestError, UnauthorizedError } from '@app/apiError';
import {
    DematAction,
    DematStatus,
    FundsSettlementFrequency,
    VerifySettlementFrequencyChangeRequestType,
    AddBankAccountRequest,
    RemoveBankRequest,
    SegmentActivationSettings,
    VerifyDematFreezeOtpType,
    InitiateDematFreezeRequest,
    ResendDematFreezeOtpType,
} from './manage.types';
import redisClient from '@app/services/redis.service';
import { EmailOtpVerification } from '@app/services/otp.service';
import SRNGenerator from '@app/services/srn-generator';

const updateSegmentActivation = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, Partial<SegmentActivationSettings>>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { cashMutualFunds, futuresAndOptions, commodityDerivatives, debt, currency } = req.body;

    const srnGenerator = new SRNGenerator('RMS');
    const srn = srnGenerator.generateTimestampSRN();

    const currentSegments = await db
        .selectFrom('investment_segments_to_user')
        .select(['segment'])
        .where('user_id', '=', userId)
        .execute();

    const currentSegmentNames = currentSegments.map((s) => s.segment);

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

    // need to make a proper db for the srn -> link with all the issues of a particular client

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

    res.status(OK).json({
        message: 'Segment activation updated successfully',
        data: {
            ...req.body,
            requiresIncomeProof,
            segmentsRequiringProof,
            srn,
            generatedAt: new Date().toISOString(),
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
            'bank_account.created_at',
            'bank_account.updated_at',
        ])
        .where('bank_to_user.user_id', '=', userId)
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

    const srnGenerator = new SRNGenerator('ACC');
    const srn = srnGenerator.generateTimestampSRN();

    const existingAccount = await db
        .selectFrom('bank_account')
        .select(['id'])
        .where('account_no', '=', account_no)
        .where('ifsc_code', '=', ifsc_code)
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
            ...req.body,
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

    const bankAccountLink = await db
        .selectFrom('bank_to_user')
        .select(['bank_account_id'])
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bankAccountId)
        .executeTakeFirst();

    if (!bankAccountLink) {
        throw new BadRequestError('Bank account not found or does not belong to this user');
    }
    await db
        .deleteFrom('bank_to_user')
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bankAccountId)
        .execute();

    res.status(OK).json({
        message: 'Bank account removed successfully',
        data: {
            ...req.body,
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

    // Get user email for OTP
    const user = await db.selectFrom('user').select(['email']).where('id', '=', userId).executeTakeFirstOrThrow();

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

    res.status(OK).json({
        message: 'OTP sent to your registered email address. Please verify to proceed.',
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

    // Resend OTP
    const emailOtp = new EmailOtpVerification(session.email, 'demat-freeze');
    await emailOtp.resendExistingOtp();

    // Update rate limit
    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 10 * 60); // 10 minutes expiration

    res.status(OK).json({
        message: 'OTP resent successfully to your registered email address',
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

const updateSettlementFrequency = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, VerifySettlementFrequencyChangeRequestType>,
    res: Response<DefaultResponseData>,
) => {
    const { userId } = req.auth!;
    const { sessionId, otp, frequency } = req.body;

    const srnGenerator = new SRNGenerator('ACC'); // ACC = Accounts & Finance
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

    if (session.frequency !== frequency) {
        throw new UnauthorizedError('Frequency mismatch with original request');
    }

    // Verify OTP
    const emailOtp = new EmailOtpVerification(session.email, 'settlement-frequency-change');
    await emailOtp.verifyOtp(otp);

    // Mark session as used
    session.isUsed = true;
    await redisClient.set(redisKey, JSON.stringify(session));

    const existingRecord = await db
        .selectFrom('user_settlement_frequency')
        .select(['user_id', 'settlement_frequency'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

    const currentTime = new Date();

    if (!existingRecord) {
        await db
            .insertInto('user_settlement_frequency')
            .values({
                user_id: userId,
                settlement_frequency: frequency,
                created_at: currentTime,
                updated_at: currentTime,
            })
            .execute();
    } else {
        // Update existing record
        await db
            .updateTable('user_settlement_frequency')
            .set({
                settlement_frequency: frequency,
                updated_at: currentTime,
            })
            .where('user_id', '=', userId)
            .execute();
    }

    let frequencyMessage;
    if (frequency === FundsSettlementFrequency.THIRTY_DAYS) {
        frequencyMessage = 'Funds settlement frequency updated to 30 days successfully';
    } else if (frequency === FundsSettlementFrequency.NINETY_DAYS) {
        frequencyMessage = 'Funds settlement frequency updated to 90 days successfully';
    } else {
        frequencyMessage = 'Funds settlement frequency updated to Bill to Bill settlement successfully';
    }
    res.status(OK).json({
        message: frequencyMessage,
        data: {
            settlementFrequency: frequency,
            updatedAt: currentTime,
            srn,
            generatedAt: currentTime.toISOString(),
        },
    });
};

export {
    updateSegmentActivation,
    getBankAccounts,
    addBankAccount,
    removeBankAccount,
    initiateDematFreeze,
    resendDematFreezeOtp,
    verifyDematFreezeOtp,
    updateSettlementFrequency,
};
