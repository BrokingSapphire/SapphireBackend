import { Request, Response } from 'express';
import { db } from '@app/database';
import logger from '@app/logger';
import {
    CREATED,
    NO_CONTENT,
    NOT_ACCEPTABLE,
    NOT_FOUND,
    OK,
    PAYMENT_REQUIRED,
    INTERNAL_SERVER_ERROR,
    BAD_REQUEST,
} from '@app/utils/httpstatus';
import { DB } from '@app/database/db';
import { UpdateVerificationRequest, verificationTypeToFieldMap } from './compliance.types';
type VerificationStatusEnum = 'pending' | 'approved' | 'rejected';
type VerificationTypeEnum =
    | 'pan'
    | 'aadhaar'
    | 'bank'
    | 'address'
    | 'signature'
    | 'ipv'
    | 'front_office'
    | 'trading_preferences'
    | 'nominee'
    | 'other_documents'
    | 'esign';

/**
 * Render verification details page
 */
const renderVerificationDetail = async (req: Request, res: Response): Promise<Response> => {
    const checkpointId = Number(req.params.checkpointId!);
    const step = req.body.step || 'step1-pan'; // Default to pan verification if step not specified

    const data = {};

    // Route to the appropriate verification step
    switch (step) {
        case 'step1-pan':
            await handlePanVerification(checkpointId, data, res);
            break;

        case 'step2-aadhar':
            await handleAadharVerification(checkpointId, data, res);
            break;

        case 'step3-bank':
            await handleBankVerification(checkpointId, data, res);
            break;

        case 'step4-address':
            await handleAddressVerification(checkpointId, data, res);
            break;

        case 'step5-signature':
            await handleSignatureVerification(checkpointId, data, res);
            break;

        case 'step6-ipv':
            await handleIPVVerification(checkpointId, data, res);
            break;

        // case 'step7-fo':
        //     await this.handleFrontOfficeVerification(checkpointId, data, res);
        //     break;

        case 'step8-trading':
            await handleTradingPreferences(checkpointId, data, res);
            break;

        case 'step9-nominee':
            await handleNomineeVerification(checkpointId, data, res);
            break;

        // case 'step10-other':
        //     await this.handleOtherDocuments(checkpointId, data, res);
        //     break;

        // case 'step11-esign':
        //     await this.handleEsignVerification(checkpointId, data, res);
        //     break;

        default:
            // Let middleware handle this as an error or bad request
            throw new Error(`Invalid verification step: ${step}`);
    }

    return res;
};

/**
 * Handle PAN verification page
 */
const handlePanVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Combined query using inner joins
    const result = await db
        .selectFrom('signup_checkpoints')
        .innerJoin('pan_detail', 'pan_detail.id', 'signup_checkpoints.pan_id')
        .innerJoin('user_name', 'user_name.id', 'pan_detail.name')
        .leftJoin('user_name as father_name_details', 'father_name_details.id', 'signup_checkpoints.father_name')
        .leftJoin('profile_pictures', 'profile_pictures.user_id', 'signup_checkpoints.id')
        .select([
            'pan_detail.id as pan_id',
            'pan_detail.pan_number',
            'pan_detail.dob',
            'user_name.first_name',
            'user_name.middle_name',
            'user_name.last_name',
            'user_name.full_name',
            'father_name_details.full_name as father_name',
            'profile_pictures.data as pan_image',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Prepare response data
    const responseData = {
        pan_id: result.pan_id,
        pan_number: result.pan_number,
        full_name: result.full_name,
        first_name: result.first_name,
        middle_name: result.middle_name,
        last_name: result.last_name,
        dob: result.dob,
        father_name: result.father_name || null,
        pan_image: result.pan_image || null,
    };

    // Send successful response
    res.status(OK).json({
        success: true,
        data: responseData,
    });
};
/**
 * Handle Aadhaar verification page
 */
const handleAadharVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Get Aadhaar details
    const aadhaarDetails = await db
        .selectFrom('aadhaar_detail')
        .leftJoin('user_name', 'user_name.id', 'aadhaar_detail.name')
        .leftJoin('address', 'address.id', 'aadhaar_detail.address_id')
        .leftJoin('city', 'city.id', 'address.city_id')
        .leftJoin('state', 'state.id', 'address.state_id')
        .leftJoin('postal_code', 'postal_code.id', 'address.postal_id')
        .leftJoin('signup_checkpoints', 'signup_checkpoints.aadhaar_id', 'aadhaar_detail.id')
        .select([
            'aadhaar_detail.id as aadhaar_id',
            'aadhaar_detail.masked_aadhaar_no',
            'aadhaar_detail.dob',
            'user_name.full_name',
            'address.address1',
            'address.address2',
            'address.street_name',
            'city.name as city_name',
            'state.name as state_name',
            'postal_code.postal_code',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Get Aadhaar image if stored separately
    // Assuming Aadhaar image might be stored in profile_pictures or a similar table
    const aadhaarImage = await db
        .selectFrom('profile_pictures')
        .select('data as aadhaar_image')
        .where('user_id', '=', checkpointId)
        .executeTakeFirst();

    // Format the complete address
    const formattedAddress = [
        aadhaarDetails.address1,
        aadhaarDetails.address2,
        aadhaarDetails.street_name,
        aadhaarDetails.city_name,
        aadhaarDetails.state_name,
        aadhaarDetails.postal_code,
    ]
        .filter(Boolean) // Remove null/undefined values
        .join(', ');

    const responseData = {
        aadhaar_id: aadhaarDetails.aadhaar_id,
        aadhaar_number: aadhaarDetails.masked_aadhaar_no,
        name: aadhaarDetails.full_name,
        dob: aadhaarDetails.dob,
        address: formattedAddress,
        address_components: {
            address1: aadhaarDetails.address1,
            address2: aadhaarDetails.address2,
            street: aadhaarDetails.street_name,
            city: aadhaarDetails.city_name,
            state: aadhaarDetails.state_name,
            postal_code: aadhaarDetails.postal_code,
        },
    };

    res.status(OK).json({
        success: true,
        data: responseData,
    });
};

/**
 * Handle bank verification page
 */
const handleBankVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Get bank accounts associated with the checkpoint
    const bankAccounts = await db
        .selectFrom('bank_to_checkpoint')
        .innerJoin('bank_account', 'bank_account.id', 'bank_to_checkpoint.bank_account_id')
        .select([
            'bank_account.id as bank_id',
            'bank_account.account_no',
            'bank_account.ifsc_code',
            'bank_account.verification',
            'bank_to_checkpoint.is_primary',
        ])
        .where('bank_to_checkpoint.checkpoint_id', '=', checkpointId)
        .execute();

    // If no bank accounts found
    if (!bankAccounts || bankAccounts.length === 0) {
        res.status(NOT_FOUND).json({
            success: false,
            message: 'No bank accounts found for this checkpoint',
        });
        return;
    }

    // Get checkpoint details to find user information
    const checkpointDetails = await db
        .selectFrom('signup_checkpoints')
        .select(['name', 'id'])
        .where('id', '=', checkpointId)
        .executeTakeFirst();

    // Format the bank accounts with available details
    const formattedBankAccountsPromises = bankAccounts.map(async (account) => {
        // Get account holder name if available
        let holderName = 'Unknown';
        if (checkpointDetails && checkpointDetails.name) {
            const nameDetails = await db
                .selectFrom('user_name')
                .select(['full_name'])
                .where('id', '=', checkpointDetails.name)
                .executeTakeFirst();

            if (nameDetails) {
                holderName = nameDetails.full_name;
            }
        }

        // Extract bank and branch codes
        const bankCode = account.ifsc_code.substring(0, 4);
        const branchCode = account.ifsc_code.substring(5);

        const bankMap: Record<string, string> = {
            HDFC: 'HDFC Bank',
            ICIC: 'ICICI Bank',
            SBIN: 'State Bank of India',
            PUNB: 'Punjab National Bank',
            AXIS: 'Axis Bank',
        };

        const bankName = bankMap[bankCode] || `Bank (Code: ${bankCode})`;

        // Default assumptions for unavailable info
        const accountType = 'Savings';
        const verificationMethod = 'Penny Drop';

        return {
            holderName,
            accountNumber: account.account_no,
            ifscCode: account.ifsc_code,
            bankName,
            branchCode,
            accountType,
            verificationMethod,
        };
    });

    const formattedBankAccounts = await Promise.all(formattedBankAccountsPromises);

    res.status(OK).json({
        success: true,
        data: {
            bankAccounts: formattedBankAccounts,
        },
    });
};
/**
 * Handle address verification page
 */
const handleAddressVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // First get the checkpoint to find address_id
    const checkpoint = await db
        .selectFrom('signup_checkpoints')
        .select(['address_id', 'aadhaar_id'])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Try to get address from checkpoint's address_id
    let addressId = checkpoint.address_id;

    // If address_id is not in checkpoint, try to get it from aadhaar_detail
    if (!addressId && checkpoint.aadhaar_id) {
        const aadhaarDetail = await db
            .selectFrom('aadhaar_detail')
            .select(['address_id'])
            .where('id', '=', checkpoint.aadhaar_id)
            .executeTakeFirst();

        if (aadhaarDetail) {
            addressId = aadhaarDetail.address_id;
        }
    }

    // If we couldn't find an address_id, return error
    if (!addressId) {
        res.status(NOT_FOUND).json({
            success: false,
            message: 'Address details not found',
        });
        return;
    }

    // Get detailed address information
    const addressDetails = await db
        .selectFrom('address')
        .leftJoin('city', 'city.id', 'address.city_id')
        .leftJoin('state', 'state.id', 'address.state_id')
        .leftJoin('postal_code', 'postal_code.id', 'address.postal_id')
        .select([
            'address.id as address_id',
            'address.address1',
            'address.address2',
            'address.street_name as address3',
            'city.name as city',
            'state.name as state',
            'postal_code.postal_code as pincode',
        ])
        .where('address.id', '=', addressId)
        .executeTakeFirstOrThrow();

    // Get address proof information
    // Note: Assuming address proof is stored elsewhere like in a documents table
    // If you have a specific table for this, replace this implementation
    const addressProof = await db
        .selectFrom('profile_pictures') // Substitute with your actual document/proof table
        .select(['data as proof_document'])
        .where('user_id', '=', checkpointId) // Adjust as needed for proper relationship
        .executeTakeFirst();

    // Determine address type - this needs to be implemented based on your business logic
    // since it's not directly in the schema
    const addressType = 'Permanent'; // Default, you may have logic to determine this

    // Get verification status
    // This could be from a separate verification_status table or field
    const verificationDetails = {
        verification_status: 'pending', // Default status
        remarks: null,
    };

    // Format the response
    const formattedAddressDetails = {
        address_type: addressType,
        address1: addressDetails.address1,
        address2: addressDetails.address2 || '',
        address3: addressDetails.address3 || '',
        city: addressDetails.city,
        state: addressDetails.state,
        pincode: addressDetails.pincode,
        address_proof: addressProof ? addressProof.proof_document : null,
        verification_status: verificationDetails.verification_status,
        remarks: verificationDetails.remarks,
    };

    // Get verification history if needed

    res.status(OK).json({
        success: true,
        data: {
            addressVerification: formattedAddressDetails,
        },
    });
};

/**
 * Handle signature verification page
 */
const handleSignatureVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Get signature details from signup_checkpoints
    const signatureDetails = await db
        .selectFrom('signup_checkpoints')
        .select(['id as checkpoint_id', 'signature', 'updated_at', 'created_at'])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    if (!signatureDetails || !signatureDetails.signature) {
        res.status(OK).json({
            success: true,
            data: {
                signatureVerification: {
                    checkpoint_id: checkpointId,
                    verification_status: 'pending',
                    uploaded: false,
                    signature_data: null,
                    upload_date: null,
                    size: null,
                },
            },
        });
        return;
    }

    // Calculate the size of the signature data
    // Assuming signature is stored as base64 encoded string
    const signatureSize = Buffer.from(signatureDetails.signature, 'base64').length;
    const formattedSize = `${Math.round((signatureSize / 1024) * 100) / 100} KB`; // Size in KB with 2 decimal places

    // Format the response
    const formattedSignatureDetails = {
        checkpoint_id: checkpointId,
        verification_status: 'pending', // Default status as per your requirements
        uploaded: true,
        signature_data: signatureDetails.signature,
        upload_date: signatureDetails.created_at, // Using created_at as upload date
        size: formattedSize,
    };

    res.status(OK).json({
        success: true,
        data: {
            signatureVerification: formattedSignatureDetails,
        },
    });
};

/**
 * Handle IPV (In-Person Verification) page
 */
const handleIPVVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Get IPV details from signup_checkpoints
    const ipvDetails = await db
        .selectFrom('signup_checkpoints')
        .select(['id as checkpoint_id', 'ipv', 'updated_at', 'created_at'])
        .where('id', '=', checkpointId)
        .executeTakeFirst();

    if (!ipvDetails || !ipvDetails.ipv) {
        res.status(OK).json({
            success: true,
            data: {
                ipvVerification: {
                    checkpoint_id: checkpointId,
                    verification_status: 'pending',
                    image_data: null,
                    captured_on: null,
                    size: null,
                },
            },
        });
        return;
    }

    // Calculate the size of the IPV image data
    // Assuming IPV is stored as base64 encoded string
    const ipvSize = Buffer.from(ipvDetails.ipv, 'base64').length;
    const formattedSize = `${Math.round((ipvSize / 1024) * 100) / 100} KB`; // Size in KB with 2 decimal places

    // Format the response
    const formattedIPVDetails = {
        checkpoint_id: checkpointId,
        verification_status: 'pending', // Default status as per your requirements
        image_data: ipvDetails.ipv,
        captured_on: ipvDetails.created_at, // Using created_at as capture date
        size: formattedSize,
    };

    res.status(OK).json({
        success: true,
        data: {
            ipvVerification: formattedIPVDetails,
        },
    });
};

/**
 * Handle trading preferences page
 */
const handleTradingPreferences = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // Get basic trading preferences from signup_checkpoints
    const checkpointDetails = await db
        .selectFrom('signup_checkpoints')
        .select([
            'id as checkpoint_id',
            'trading_exp',
            'annual_income',
            'is_politically_exposed',
            'account_settlement',
            'name',
        ])
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Get account holder name from user_name table
    let accountHolderName = 'Unknown';
    if (checkpointDetails.name) {
        const nameDetails = await db
            .selectFrom('user_name')
            .select(['full_name'])
            .where('id', '=', checkpointDetails.name)
            .executeTakeFirst();

        if (nameDetails) {
            accountHolderName = nameDetails.full_name;
        }
    }

    // Get investment segments
    const segments = await db
        .selectFrom('investment_segments_to_checkpoint')
        .select(['segment'])
        .where('checkpoint_id', '=', checkpointId)
        .execute();

    // Format the segments
    const tradingSegments = segments.map((s) => s.segment);

    // The following fields are not directly in the schema
    // In a real implementation, these would come from additional tables
    // For now, we'll use placeholder values or defaults

    // Generate mock demat account details
    // In production, you would pull these from your actual database
    const dematId = `DEMAT${10000 + checkpointId}`;
    const dpId = `IN${300000 + checkpointId}`;
    const clientId = `CL${500000 + checkpointId}`;

    // Format the response
    const tradingPreferencesData = {
        // Account information
        account_holder_name: accountHolderName,
        demat_account_id: dematId,
        dp_id: dpId,
        client_id: clientId,
        demat_account_status: 'Active', // Default status

        // Trading preferences
        trading_segments: tradingSegments,
        trading_exp: checkpointDetails.trading_exp,
        annual_income: checkpointDetails.annual_income,
        is_politically_exposed: checkpointDetails.is_politically_exposed || false,

        // Contract and settlement
        contract_note_mode: 'Electronic', // Default mode
        settlement_preference: checkpointDetails.account_settlement || 'Monthly',

        // Brokerage and platform
        brokerage_plan: 'Standard', // Default plan
        trading_platform_credentials: {
            user_id: `USER${100000 + checkpointId}`,
            status: 'Active',
        },
    };

    res.status(OK).json({
        success: true,
        data: {
            tradingPreferences: tradingPreferencesData,
        },
    });
};

/**
 * Handle nominee verification page
 */
const handleNomineeVerification = async (checkpointId: number, data: any, res: Response): Promise<void> => {
    // First check if the checkpoint has any nominees
    const nomineeRecords = await db
        .selectFrom('nominees_to_checkpoint')
        .select('nominees_id')
        .where('checkpoint_id', '=', checkpointId)
        .execute();

    const hasNominees = nomineeRecords.length > 0;

    if (!hasNominees) {
        // No nominees found
        res.status(OK).json({
            success: true,
            data: {
                hasNominees: false,
                nomineeType: null,
                nominees: [],
            },
        });
        return;
    }

    // Get detailed nominee information
    const nominees = await db
        .selectFrom('nominees_to_checkpoint')
        .innerJoin('nominees', 'nominees.id', 'nominees_to_checkpoint.nominees_id')
        .innerJoin('user_name', 'user_name.id', 'nominees.name')
        .leftJoin('pan_detail', 'pan_detail.id', 'nominees.pan_id')
        .leftJoin('aadhaar_detail', 'aadhaar_detail.id', 'nominees.aadhaar_id')
        .leftJoin('address', 'address.id', 'aadhaar_detail.address_id')
        .leftJoin('city', 'city.id', 'address.city_id')
        .leftJoin('state', 'state.id', 'address.state_id')
        .leftJoin('postal_code', 'postal_code.id', 'address.postal_id')
        .select([
            'nominees.id as nominee_id',
            'user_name.first_name',
            'user_name.middle_name',
            'user_name.last_name',
            'user_name.full_name',
            'nominees.relationship',
            'nominees.share',
            'pan_detail.dob',
            'pan_detail.pan_number',
            'address.address1',
            'address.address2',
            'address.street_name',
            'city.name as city_name',
            'state.name as state_name',
            'postal_code.postal_code',
        ])
        .where('nominees_to_checkpoint.checkpoint_id', '=', checkpointId)
        .execute();

    // Format the nominees data
    const formattedNominees = nominees.map((nominee) => {
        // Construct address if available
        let address = null;
        if (nominee.address1) {
            address = [
                nominee.address1,
                nominee.address2,
                nominee.street_name,
                nominee.city_name,
                nominee.state_name,
                nominee.postal_code,
            ]
                .filter(Boolean) // Remove null/undefined values
                .join(', ');
        }

        return {
            nominee_id: nominee.nominee_id,
            name: nominee.full_name,
            relationship: nominee.relationship,
            dob: nominee.dob,
            pan: nominee.pan_number,
            address,
            allocation_percentage: nominee.share,
        };
    });

    // Determine nominee type (single or multiple)
    const nomineeType = formattedNominees.length > 1 ? 'multiple' : 'single';

    // Verify allocation total equals 100% for multiple nominees
    if (nomineeType === 'multiple') {
        const totalAllocation = formattedNominees.reduce(
            (sum, nominee) => sum + (nominee.allocation_percentage || 0),
            0,
        );

        if (Math.abs(totalAllocation - 100) > 0.01) {
            // Allow small floating point error
            logger.warn(
                `Nominee allocation total (${totalAllocation}%) does not equal 100% for checkpoint ${checkpointId}`,
            );
        }
    }

    res.status(OK).json({
        success: true,
        data: {
            hasNominees: true,
            nomineeType,
            nominees: formattedNominees,
        },
    });
};
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
const updateVerificationStatus = async (req: Request, res: Response): Promise<Response> => {
    const checkpointId = Number(req.params.checkpointId);
    const { verificationType, status } = req.body as UpdateVerificationRequest;

    // Get the corresponding field name in the database
    const statusFieldName = verificationTypeToFieldMap[verificationType];

    // Check if verification record exists for this checkpoint
    const verificationRecord = await db
        .selectFrom('signup_verification_status')
        .select(['id'])
        .where('id', '=', checkpointId)
        .executeTakeFirst();

    const now = new Date();

    if (verificationRecord) {
        // Use type assertion to safely update the field
        const updateData: Record<string, any> = {
            updated_at: now,
        };
        updateData[statusFieldName] = status;

        await db
            .updateTable('signup_verification_status')
            .set(updateData)
            .where('id', '=', verificationRecord.id)
            .execute();
    } else {
        // Create a new record with all statuses as pending
        const insertData: Record<string, any> = {
            id: checkpointId,
            created_at: now,
            updated_at: now,
        };

        // Set all verification status fields to pending
        Object.values(verificationTypeToFieldMap).forEach((field) => {
            insertData[field] = 'pending';
        });

        // Override with the specific status being set
        insertData[statusFieldName] = status;

        // Set the overall status to pending
        insertData.overall_status = 'pending';

        await db.insertInto('signup_verification_status').values(insertData).execute();
    }

    return res.status(OK).json({
        success: true,
        message: `${verificationType} verification status updated to ${status}`,
    });
};

/**
 * Get verification status for a checkpoint
 */
const getVerificationStatus = async (req: Request, res: Response): Promise<Response> => {
    const checkpointId = Number(req.params.checkpointId);

    // Get verification status
    const verificationStatus = await db
        .selectFrom('signup_verification_status')
        .selectAll()
        .where('id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    return res.status(OK).json({
        success: true,
        data: verificationStatus,
    });
};

/**
 * Gets checkpoint details including name, email, phone, PAN, client code, and profile image
 */
const handleGetCheckpointDetails = async (req: Request, res: Response): Promise<void> => {
    const checkpointId = parseInt(req.params.checkpointId, 10);

    // Combined query using joins to fetch all required data
    const result = await db
        .selectFrom('signup_checkpoints')
        .leftJoin('phone_number', 'phone_number.id', 'signup_checkpoints.phone_id')
        .leftJoin('pan_detail', 'pan_detail.id', 'signup_checkpoints.pan_id')
        .leftJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
        .leftJoin('profile_pictures', 'profile_pictures.user_id', 'signup_checkpoints.id')
        .select([
            'signup_checkpoints.id as checkpoint_id',
            'signup_checkpoints.email',
            'phone_number.phone',
            'pan_detail.pan_number',
            'user_name.first_name',
            'user_name.middle_name',
            'user_name.last_name',
            'user_name.full_name',
            'profile_pictures.data as profile_image',
        ])
        .where('signup_checkpoints.id', '=', checkpointId)
        .executeTakeFirstOrThrow();

    // Generate a client code (this could follow your business logic)
    // For example, using first 3 characters of full name + last 5 digits of phone
    const clientCode = result.full_name
        ? `${result.full_name.substring(0, 3).toUpperCase()}${result.phone?.substring(result.phone.length - 5) || ''}`
        : `USER${checkpointId}`;

    // Prepare response data
    const responseData = {
        checkpoint_id: result.checkpoint_id,
        email: result.email,
        phone: result.phone || null,
        pan_number: result.pan_number || null,
        full_name: result.full_name || null,
        first_name: result.first_name || null,
        middle_name: result.middle_name || null,
        last_name: result.last_name || null,
        client_code: clientCode,
        profile_image: result.profile_image || null,
    };

    // Send successful response
    res.status(OK).json({
        success: true,
        data: responseData,
    });
};

/**
 * Controller to finalize verification and create user account
 * POST /finalize-verification/:checkpointId
 */
const finalizeVerification = async (req: Request, res: Response) => {
    const { checkpointId } = req.params;
    const checkpointIdNum = Number(checkpointId);

    // STEP 1: Check if all verification statuses are verified
    const verificationStatus = await db
        .selectFrom('signup_verification_status')
        .where('id', '=', checkpointIdNum)
        .selectAll()
        .executeTakeFirstOrThrow();

    // Check all verification statuses
    const allVerified = [
        verificationStatus.pan_status,
        verificationStatus.aadhaar_status,
        verificationStatus.bank_status,
        verificationStatus.address_status,
        verificationStatus.signature_status,
        verificationStatus.ipv_status,
        verificationStatus.front_office_status,
        verificationStatus.trading_preferences_status,
        verificationStatus.nominee_status,
        verificationStatus.other_documents_status,
        verificationStatus.esign_status,
    ].every((status) => status === 'verified');

    if (!allVerified) {
        return res.status(BAD_REQUEST).json({
            success: false,
            message: 'Not all verification steps are completed',
        });
    }

    // STEP 2: Update overall status to verified if not already
    if (verificationStatus.overall_status !== 'verified') {
        await db
            .updateTable('signup_verification_status')
            .set({
                overall_status: 'verified',
                updated_at: new Date(),
            })
            .where('id', '=', checkpointIdNum)
            .execute();
    }

    // STEP 3: Get checkpoint data to populate user table
    const checkpoint = await db
        .selectFrom('signup_checkpoints')
        .where('id', '=', checkpointIdNum)
        .selectAll()
        .executeTakeFirstOrThrow();

    // STEP 4: Start a transaction to ensure all operations are atomic
    await db.transaction().execute(async (trx) => {
        // Check if user already exists to avoid duplicates
        const existingUser = await trx
            .selectFrom('user')
            .where('id', '=', checkpointIdNum)
            .select('id')
            .executeTakeFirst();

        if (existingUser) {
            // User already created, skip to cleanup
            logger.info(`User with ID ${checkpointIdNum} already exists, skipping creation`);
        } else {
            // Insert into user table
            await trx
                .insertInto('user')
                .values({
                    id: checkpointIdNum,
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
                .expression(
                    trx
                        .selectFrom('bank_to_checkpoint')
                        .select([trx.val(checkpointIdNum).as('user_id'), 'bank_account_id', 'is_primary'])
                        .where('checkpoint_id', '=', checkpointIdNum),
                )
                .execute();

            // Copy nominees
            await trx
                .insertInto('nominees_to_user')
                .columns(['user_id', 'nominees_id'])
                .expression(
                    trx
                        .selectFrom('nominees_to_checkpoint')
                        .select([trx.val(checkpointIdNum).as('user_id'), 'nominees_id'])
                        .where('checkpoint_id', '=', checkpointIdNum),
                )
                .execute();

            // Copy investment segments
            await trx
                .insertInto('investment_segments_to_user')
                .columns(['user_id', 'segment'])
                .expression(
                    trx
                        .selectFrom('investment_segments_to_checkpoint')
                        .select([trx.val(checkpointIdNum).as('user_id'), 'segment'])
                        .where('checkpoint_id', '=', checkpointIdNum),
                )
                .execute();

            // Create initial balance
            await trx
                .insertInto('user_balance')
                .values({
                    user_id: checkpointIdNum,
                    available_cash: 0,
                    blocked_cash: 0,
                    available_liq_margin: 0,
                    available_non_liq_margin: 0,
                    blocked_margin: 0,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .execute();
        }

        // STEP 5: Delete checkpoint data after successful user creation
        // Note: We're removing the checkpoint data as per your requirement
        // First remove child records
        await trx.deleteFrom('bank_to_checkpoint').where('checkpoint_id', '=', checkpointIdNum).execute();

        await trx.deleteFrom('nominees_to_checkpoint').where('checkpoint_id', '=', checkpointIdNum).execute();

        await trx
            .deleteFrom('investment_segments_to_checkpoint')
            .where('checkpoint_id', '=', checkpointIdNum)
            .execute();

        // Then remove the main checkpoint record
        await trx.deleteFrom('signup_checkpoints').where('id', '=', checkpointIdNum).execute();
    });

    return res.status(OK).json({
        success: true,
        message: 'User account created successfully and checkpoint data deleted',
        data: {
            userId: checkpointIdNum,
        },
    });
};

export {
    renderVerificationDetail,
    updateVerificationStatus,
    getVerificationStatus,
    handleGetCheckpointDetails,
    finalizeVerification,
};
