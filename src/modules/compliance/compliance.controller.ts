import { Request, Response } from '@app/types.d';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';
import { UpdateVerificationRequest, VerificationType, verificationTypeToFieldMap } from './compliance.types';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@app/apiError';
import BankDetailsService, { BankDetails } from '@app/services/bank-details.service';
import { SessionJwtType } from '../common.types';

const assignOfficer = async (req: Request<SessionJwtType>, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    const result = await db.transaction().execute(async (tx) => {
        return await tx
            .insertInto('compliance_processing')
            .values({
                officer_id: req.auth!!.userId,
                checkpoint_id: checkpointId,
            })
            .onConflict((oc) => oc.constraint('PK_Compliance_Checkpoint_Id').doNothing())
            .returning('checkpoint_id')
            .execute();
    });

    if (result.length > 0) {
        res.status(OK).json({
            message: 'Compliance officer assigned successfully.',
        });
    } else {
        throw new ForbiddenError('Officer already assigned.');
    }
};

/**
 * Render verification details page
 */
const getVerificationDetail = async (req: Request, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    const verified = await db
        .selectFrom('signup_verification_status')
        .select(verificationTypeToFieldMap[req.params.step as VerificationType])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    if (verified[verificationTypeToFieldMap[req.params.step as VerificationType]] === 'processing') {
        res.status(OK).json({
            message: 'Verification is still in progress',
            data: {
                status: verified[verificationTypeToFieldMap[req.params.step as VerificationType]],
            },
        });
        return;
    }

    let responseData;
    switch (req.params.step) {
        case VerificationType.PAN:
            responseData = await fetchPanVerificationData(checkpointId);
            break;

        case VerificationType.AADHAAR:
            responseData = await fetchAadhaarVerificationData(checkpointId);
            break;

        case VerificationType.BANK:
            responseData = await fetchBankVerificationData(checkpointId);
            break;

        case VerificationType.ADDRESS:
            responseData = await fetchAddressVerificationData(checkpointId);
            break;

        case VerificationType.SIGNATURE:
            responseData = await fetchSignatureVerificationData(checkpointId);
            break;

        case VerificationType.IPV:
            responseData = await fetchIPVVerificationData(checkpointId);
            break;

        case VerificationType.TRADING_PREFERENCES:
            responseData = await fetchTradingPreferencesData(checkpointId);
            break;

        // case VerificationType.NOMINEE:
        //     responseData = await fetchNomineeVerificationData(checkpointId);
        //     break;

        // case VerificationType.FRONT_OFFICE:
        //     responseData = await fetchFrontOfficeVerificationData(checkpointId);
        //     break;

        // case VerificationType.OTHER_DOCUMENTS:
        //     responseData = await fetchOtherDocumentsData(checkpointId);
        //     break;

        // case VerificationType.ESIGN:
        //     responseData = await fetchEsignVerificationData(checkpointId);
        //     break;

        default:
            throw new Error(`Invalid verification step: ${req.params.step}`);
    }

    res.status(OK).json({
        message: 'Verification details fetched successfully',
        data: {
            [req.params.step]: responseData,
            status: verified[verificationTypeToFieldMap[req.params.step]],
        },
    });
};

/**
 * Fetch PAN verification data
 */
const fetchPanVerificationData = async (checkpointId: number) => {
    const result = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('pan_detail', 'pan_detail.id', 'signup_checkpoints.pan_id')
        .innerJoin('user_name', 'user_name.id', 'pan_detail.name')
        .innerJoin('user_name as father_name_details', 'father_name_details.id', 'signup_checkpoints.father_name')
        .innerJoin('profile_pictures', 'profile_pictures.user_id', 'signup_checkpoints.id')
        .select([
            'pan_detail.pan_number',
            'pan_detail.dob',
            'user_name.full_name',
            'father_name_details.full_name as father_name',
            'profile_pictures.data as pan_image',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return {
        pan_number: result.pan_number,
        full_name: result.full_name,
        dob: result.dob,
        father_name: result.father_name,
        pan_image: result.pan_image,
    };
};

/**
 * Fetch Aadhaar verification data
 */
const fetchAadhaarVerificationData = async (checkpointId: number) => {
    const aadhaarDetails = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('aadhaar_detail', 'aadhaar_detail.id', 'signup_checkpoints.aadhaar_id')
        .innerJoin('user_name', 'user_name.id', 'aadhaar_detail.name')
        .innerJoin('address', 'address.id', 'aadhaar_detail.address_id')
        .innerJoin('city', 'city.id', 'address.city_id')
        .innerJoin('state', 'state.id', 'address.state_id')
        .innerJoin('postal_code', 'postal_code.id', 'address.postal_id')
        .innerJoin('country', 'country.iso', 'address.country_id')
        .select([
            'aadhaar_detail.masked_aadhaar_no',
            'aadhaar_detail.dob',
            'user_name.full_name',
            'address.address1',
            'address.address2',
            'address.street_name',
            'city.name as city_name',
            'state.name as state_name',
            'postal_code.postal_code',
            'country.name as country_name',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return {
        aadhaar_number: aadhaarDetails.masked_aadhaar_no,
        name: aadhaarDetails.full_name,
        dob: aadhaarDetails.dob,
        address: {
            address1: aadhaarDetails.address1,
            address2: aadhaarDetails.address2,
            street: aadhaarDetails.street_name,
            city: aadhaarDetails.city_name,
            state: aadhaarDetails.state_name,
            postalCode: aadhaarDetails.postal_code,
            country: aadhaarDetails.country_name,
        },
    };
};

/**
 * Fetch bank verification data
 */
const fetchBankVerificationData = async (checkpointId: number) => {
    const bankAccounts = await db
        .selectFrom('signup_checkpoints')
        .leftJoin('bank_to_checkpoint', 'bank_to_checkpoint.checkpoint_id', 'signup_checkpoints.id')
        .innerJoin('bank_account', 'bank_account.id', 'bank_to_checkpoint.bank_account_id')
        .innerJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
        .select([
            'signup_checkpoints.id',
            'user_name.full_name',
            'bank_account.id as bank_id',
            'bank_account.account_no',
            'bank_account.ifsc_code',
            'bank_account.verification',
            'bank_to_checkpoint.is_primary',
        ])
        .where('bank_to_checkpoint.checkpoint_id', '=', checkpointId)
        .execute();

    const bankDetails = (
        await Promise.all(bankAccounts.map((account) => BankDetailsService.getBankDetailsByIFSC(account.ifsc_code)))
    ).reduce<Map<string, BankDetails>>((acc, bank) => {
        if (bank) {
            acc.set(bank.IFSC, bank);
        }
        return acc;
    }, new Map());

    return bankAccounts.map((account) => {
        const bankDetail = bankDetails.get(account.ifsc_code);

        return {
            holderName: account.full_name,
            accountNumber: account.account_no,
            ifscCode: account.ifsc_code,
            bankName: bankDetail?.BANK || `Bank (Code: ${BankDetailsService.getBankCodeFromIFSC(account.ifsc_code)})`,
            branchCode: bankDetail?.BRANCH || account.ifsc_code.substring(5),
            accountType: 'Savings',
            verificationMethod: 'Reverse Penny Drop',
        };
    });
};

/**
 * Fetch address verification data
 */
const fetchAddressVerificationData = async (checkpointId: number) => {
    const addressDetails = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('address', 'address.id', 'signup_checkpoints.address_id')
        .innerJoin('city', 'city.id', 'address.city_id')
        .innerJoin('state', 'state.id', 'address.state_id')
        .innerJoin('postal_code', 'postal_code.id', 'address.postal_id')
        .innerJoin('country', 'country.iso', 'address.country_id')
        .leftJoin('profile_pictures', 'profile_pictures.user_id', 'signup_checkpoints.id')
        .select([
            'address.address1',
            'address.address2',
            'address.street_name',
            'city.name as city',
            'state.name as state',
            'postal_code.postal_code',
            'country.name as country_name',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return {
        address1: addressDetails.address1,
        address2: addressDetails.address2,
        street: addressDetails.street_name,
        city: addressDetails.city,
        state: addressDetails.state,
        postalCode: addressDetails.postal_code,
    };
};

/**
 * Fetch signature verification data
 */
const fetchSignatureVerificationData = async (checkpointId: number) => {
    const signatureDetails = await db
        .selectFrom('signup_checkpoints')
        .select('signature')
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return {
        link: signatureDetails.signature,
    };
};

/**
 * Fetch IPV (In-Person Verification) data
 */
const fetchIPVVerificationData = async (checkpointId: number) => {
    const ipvDetails = await db
        .selectFrom('signup_checkpoints')
        .select(['ipv'])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return {
        link: ipvDetails.ipv,
    };
};

/**
 * Fetch trading preferences data
 */
const fetchTradingPreferencesData = async (checkpointId: number) => {
    const checkpointDetails = await db
        .selectFrom('signup_checkpoints')
        .select([
            'signup_checkpoints.trading_exp',
            'signup_checkpoints.annual_income',
            'signup_checkpoints.is_politically_exposed',
        ])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    const segments = await db
        .selectFrom('investment_segments_to_checkpoint')
        .select(['segment'])
        .where('checkpoint_id', '=', checkpointId)
        .execute();

    const tradingSegments = segments.map((s) => s.segment);

    return {
        segments: tradingSegments,
        tradingExperience: checkpointDetails.trading_exp,
        annualIncome: checkpointDetails.annual_income,
        isPoliticallyExposed: checkpointDetails.is_politically_exposed || false,
    };
};

/**
 * Fetch nominee verification data
 */
// const fetchNomineeVerificationData = async (checkpointId: number) => {
//     const nominees = await db
//         .selectFrom('nominees_to_checkpoint')
//         .innerJoin('nominees', 'nominees.id', 'nominees_to_checkpoint.nominees_id')
//         .innerJoin('user_name', 'user_name.id', 'nominees.name')
//         .leftJoin('pan_detail', 'pan_detail.id', 'nominees.pan_id')
//         .leftJoin('aadhaar_detail', 'aadhaar_detail.id', 'nominees.aadhaar_id')
//         .leftJoin('address', 'address.id', 'aadhaar_detail.address_id')
//         .leftJoin('city', 'city.id', 'address.city_id')
//         .leftJoin('state', 'state.id', 'address.state_id')
//         .leftJoin('postal_code', 'postal_code.id', 'address.postal_id')
//         .select([
//             'nominees.id as nominee_id',
//             'user_name.first_name',
//             'user_name.middle_name',
//             'user_name.last_name',
//             'user_name.full_name',
//             'nominees.relationship',
//             'nominees.share',
//             'pan_detail.dob',
//             'pan_detail.pan_number',
//             'address.address1',
//             'address.address2',
//             'address.street_name',
//             'city.name as city_name',
//             'state.name as state_name',
//             'postal_code.postal_code',
//         ])
//         .where('nominees_to_checkpoint.checkpoint_id', '=', checkpointId)
//         .execute();

//     const formattedNominees = nominees.map((nominee) => {
//         let address = null;
//         if (nominee.address1) {
//             address = [
//                 nominee.address1,
//                 nominee.address2,
//                 nominee.street_name,
//                 nominee.city_name,
//                 nominee.state_name,
//                 nominee.postal_code,
//             ]
//                 .filter(Boolean)
//                 .join(', ');
//         }

//         return {
//             nominee_id: nominee.nominee_id,
//             name: nominee.full_name,
//             relationship: nominee.relationship,
//             dob: nominee.dob,
//             pan: nominee.pan_number,
//             address,
//             allocation_percentage: nominee.share,
//         };
//     });

//     const nomineeType = formattedNominees.length > 1 ? 'multiple' : 'single';

//     if (nomineeType === 'multiple') {
//         const totalAllocation = formattedNominees.reduce(
//             (sum, nominee) => sum + (nominee.allocation_percentage || 0),
//             0,
//         );

//         if (Math.abs(totalAllocation - 100) > 0.01) {
//             logger.warn(
//                 `Nominee allocation total (${totalAllocation}%) does not equal 100% for checkpoint ${checkpointId}`,
//             );
//         }
//     }

//     return {
//         hasNominees: true,
//         nomineeType,
//         nominees: formattedNominees,
//     };
// };
/**
 * Handle other documents page (not implememnted )
 */
// const handleOtherDocuments(checkpointId: number, data: any, res: Response): Promise<void> {},

/**
 * Handle e-sign verification page (not implemented)
 */
// const handleEsignVerification(checkpointId: number, data: any, res: Response): Promise<void> {},
/**
 * Update verification status for a checkpoint
 */
const updateVerificationStatus = async (req: Request<SessionJwtType>, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    const officer = await db
        .selectFrom('compliance_processing')
        .select('officer_id')
        .where('checkpoint_id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    if (officer.officer_id !== req.auth?.userId) {
        throw new UnauthorizedError();
    }

    const { verificationType, status } = req.body as UpdateVerificationRequest;

    const statusFieldName = verificationTypeToFieldMap[verificationType];

    await db
        .updateTable('signup_verification_status')
        .set({
            [statusFieldName]: status === 'approve' ? 'verified' : 'rejected',
            updated_at: new Date(),
        })
        .where('id', '=', checkpointId)
        .execute();

    res.status(OK).json({
        message: `${verificationType} verification status updated to ${status}`,
    });
};

/**
 * Get verification status for a checkpoint
 */
const getVerificationStepStatus = async (req: Request, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);
    const step = req.params.step as VerificationType;

    // Get verification status
    const verificationStatus = await db
        .selectFrom('signup_verification_status')
        .select(verificationTypeToFieldMap[step])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    res.status(OK).json({
        message: `${step} verification status fetched successfully`,
        data: {
            status: verificationStatus[verificationTypeToFieldMap[step]],
        },
    });
};

const getVerificationStatus = async (req: Request, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    // Get verification status
    const verificationStatus = await db
        .selectFrom('signup_verification_status')
        .select('overall_status')
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    res.status(OK).json({
        message: 'Verification status fetched successfully',
        data: {
            status: verificationStatus.overall_status,
        },
    });
};

/**
 * Gets checkpoint details including name, email, phone, PAN, client code, and profile image
 */
const getCheckpointDetails = async (req: Request, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    const result = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('phone_number', 'phone_number.id', 'signup_checkpoints.phone_id')
        .innerJoin('pan_detail', 'pan_detail.id', 'signup_checkpoints.pan_id')
        .innerJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
        .innerJoin('profile_pictures', 'profile_pictures.user_id', 'signup_checkpoints.id')
        .select([
            'signup_checkpoints.email',
            'signup_checkpoints.ipv',
            'phone_number.phone',
            'pan_detail.pan_number',
            'user_name.full_name',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Send successful response
    res.status(OK).json({
        message: 'Checkpoint details fetched successfully',
        data: {
            email: result.email,
            phone: result.phone,
            panNumber: result.pan_number,
            name: result.full_name,
            clientId: checkpointId, // TODO: Replace with actual client code if available
            image: result.ipv,
        },
    });
};

/**
 * Skip all verification steps and mark the user as verified
 * POST /:checkpointId/skip-verification
 */
const skipVerification = async (req: Request<SessionJwtType>, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    await db.transaction().execute(async (trx) => {
        const verificationSteps = Object.keys(verificationTypeToFieldMap) as VerificationType[];

        // Update all verification steps to 'verified'
        const updateValues: Record<string, string> = {};
        verificationSteps.forEach((step) => {
            updateValues[verificationTypeToFieldMap[step]] = 'verified';
        });

        updateValues.overall_status = 'verified';
        updateValues.updated_at = new Date().toISOString();

        await trx.updateTable('signup_verification_status').set(updateValues).where('id', '=', checkpointId).execute();
    });

    // Return success response
    res.status(OK).json({
        message: 'All verification steps have been skipped and the user is now verified.',
        data: {
            status: 'verified',
        },
    });
};

/**
 * Controller to finalize verification and create user account
 * POST /finalize-verification/:checkpointId
 */
const finalizeVerification = async (req: Request, res: Response) => {
    const checkpointId = Number(req.params.checkpointId);

    // STEP 1: Check if all verification statuses are verified
    const verificationStatus = await db
        .selectFrom('signup_verification_status')
        .select('overall_status')
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    if (verificationStatus.overall_status === 'pending') {
        throw new BadRequestError('All verification steps must be completed before finalizing.');
    } else if (verificationStatus.overall_status === 'rejected') {
        throw new BadRequestError('Verification has been rejected. Please contact support.');
    }

    await db.transaction().execute(async (trx) => {
        // Check if user already exists to avoid duplicates
        // Insert into user table

        const checkpoint = await db
            .selectFrom('signup_checkpoints')
            .selectAll()
            .where('id', '=', checkpointId)
            .executeTakeFirstOrThrow();

        await trx
            .insertInto('user')
            .values({
                id: checkpoint.client_id!,
                email: checkpoint.email,
                name: checkpoint.name!,
                dob: checkpoint.dob!,
                phone: checkpoint.phone_id,
                pan_id: checkpoint.pan_id!,
                aadhaar_id: checkpoint.aadhaar_id!,
                address_id: checkpoint.address_id!,
                father_name: checkpoint.father_name!,
                mother_name: checkpoint.mother_name!,
                marital_status: checkpoint.marital_status!,
                annual_income: checkpoint.annual_income!,
                occupation: checkpoint.occupation!,
                trading_exp: checkpoint.trading_exp!,
                account_settlement: checkpoint.account_settlement!,
                is_politically_exposed: checkpoint.is_politically_exposed ?? false,
                signature: checkpoint.signature!,
                ipv: checkpoint.ipv!,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .execute();

        // Copy bank accounts
        await trx
            .insertInto('bank_to_user')
            .columns(['user_id', 'bank_account_id', 'is_primary'])
            .expression((eb) =>
                eb
                    .selectFrom('bank_to_checkpoint')
                    .select([eb.val(checkpoint.client_id).as('user_id'), 'bank_account_id', 'is_primary'])
                    .where('checkpoint_id', '=', checkpointId),
            )
            .execute();

        // Copy nominees
        await trx
            .insertInto('nominees_to_user')
            .columns(['user_id', 'nominees_id'])
            .expression((eb) =>
                eb
                    .selectFrom('nominees_to_checkpoint')
                    .select([eb.val(checkpoint.client_id).as('user_id'), 'nominees_id'])
                    .where('checkpoint_id', '=', checkpointId),
            )
            .execute();

        // Copy investment segments
        await trx
            .insertInto('investment_segments_to_user')
            .columns(['user_id', 'segment'])
            .expression((eb) =>
                eb
                    .selectFrom('investment_segments_to_checkpoint')
                    .select([eb.val(checkpoint.client_id).as('user_id'), 'segment'])
                    .where('checkpoint_id', '=', checkpointId),
            )
            .execute();

        // Create initial balance
        await trx
            .insertInto('user_balance')
            .values({
                user_id: checkpoint.client_id,
                available_cash: 0,
                blocked_cash: 0,
                available_liq_margin: 0,
                available_non_liq_margin: 0,
                blocked_margin: 0,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .execute();

        // First remove child records
        await trx.deleteFrom('bank_to_checkpoint').where('checkpoint_id', '=', checkpointId).execute();

        await trx.deleteFrom('nominees_to_checkpoint').where('checkpoint_id', '=', checkpointId).execute();

        await trx.deleteFrom('investment_segments_to_checkpoint').where('checkpoint_id', '=', checkpointId).execute();

        // Then remove the main checkpoint record
        await trx.deleteFrom('signup_checkpoints').where('id', '=', checkpointId).execute();
    });

    res.status(OK).json({
        message: 'User account created successfully.',
        data: {
            userId: checkpointId,
        },
    });
};

export {
    assignOfficer,
    getVerificationDetail,
    updateVerificationStatus,
    getVerificationStepStatus,
    getVerificationStatus,
    getCheckpointDetails,
    skipVerification,
    finalizeVerification,
};
