// src/controllers/compliance.controller.ts
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

const complianceController = {
    /**
     * Render verification details page
     */
    async renderVerificationDetails(req: Request, res: Response): Promise<Response> {
        try {
            const checkpointId = Number(req.params.checkpointId);
            const step = req.body.step || 'step1-pan'; // Default to pan verification if step not specified

            const data = {};

            // Route to the appropriate verification step
            switch (step) {
                case 'step1-pan':
                    await this.handlePanVerification(checkpointId, data, res);
                    break;

                case 'step2-aadhar':
                    await this.handleAadharVerification(checkpointId, data, res);
                    break;

                case 'step3-bank':
                    await this.handleBankVerification(checkpointId, data, res);
                    break;

                case 'step4-address':
                    await this.handleAddressVerification(checkpointId, data, res);
                    break;

                case 'step5-signature':
                    await this.handleSignatureVerification(checkpointId, data, res);
                    break;

                case 'step6-ipv':
                    await this.handleIPVVerification(checkpointId, data, res);
                    break;

                // case 'step7-fo':
                //     await this.handleFrontOfficeVerification(checkpointId, data, res);
                //     break;

                case 'step8-trading':
                    await this.handleTradingPreferences(checkpointId, data, res);
                    break;

                case 'step9-nominee':
                    await this.handleNomineeVerification(checkpointId, data, res);
                    break;

                // case 'step10-other':
                //     await this.handleOtherDocuments(checkpointId, data, res);
                //     break;

                // case 'step11-esign':
                //     await this.handleEsignVerification(checkpointId, data, res);
                //     break;

                default:
                    // If invalid step, return bad request
                    return res.status(BAD_REQUEST).json({
                        success: false,
                        message: 'Invalid verification step',
                    });
            }

            // This return is only reached if the handler doesn't send a response
            return res;

        } catch (error) {
            logger.error('Error processing verification details:', error);
            return res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'An error occurred while processing your request',
            });
        }
    },
    /**
     * Handle PAN verification page
     */
    async handlePanVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
            // Get the checkpoint data using Kysely
            const checkpoint = await db
                .selectFrom('signup_checkpoints')
                .select(['id', 'pan_id', 'father_name', 'name'])
                .where('id', '=', checkpointId)
                .executeTakeFirst();

            if (!checkpoint) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'Checkpoint not found',
                });
                return;
            }

            // Get PAN card details using Kysely
            const panDetails = await db
                .selectFrom('pan_detail')
                .innerJoin('user_name', 'user_name.id', 'pan_detail.name')
                .select([
                    'pan_detail.id as pan_id',
                    'pan_detail.pan_number',
                    'pan_detail.dob',
                    'user_name.first_name',
                    'user_name.middle_name',
                    'user_name.last_name',
                    'user_name.full_name',
                ])
                .where('pan_detail.id', '=', checkpoint.pan_id)
                .executeTakeFirst();

            if (!panDetails) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'PAN card details not found for this checkpoint',
                });
                return;
            }

            // Get father's name details using Kysely
            let fatherName = null;
            if (checkpoint.father_name) {
                const fatherNameDetails = await db
                    .selectFrom('user_name')
                    .select('full_name')
                    .where('id', '=', checkpoint.father_name)
                    .executeTakeFirst();

                fatherName = fatherNameDetails?.full_name || null;
            }

            // Get PAN card image using Kysely
            const panImage = await db
                .selectFrom('profile_pictures')
                .select('data as pan_image')
                .where('user_id', '=', checkpointId)
                .executeTakeFirst();

            // Prepare response data
            const responseData = {
                pan_id: panDetails.pan_id,
                pan_number: panDetails.pan_number,
                full_name: panDetails.full_name,
                first_name: panDetails.first_name,
                middle_name: panDetails.middle_name,
                last_name: panDetails.last_name,
                dob: panDetails.dob,
                father_name: fatherName,
                pan_image: panImage?.pan_image || null,
            };

            // Send successful response
            res.status(OK).json({
                success: true,
                data: responseData,
            });
        } catch (error) {
            // Log error and send error response
            logger.error('Error retrieving PAN card details:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving PAN card details',
            });
        }
    },
    /**
     * Handle Aadhaar verification page
     */
    async handleAadharVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
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
                .executeTakeFirst();

            // If Aadhaar details are not found
            if (!aadhaarDetails) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'Aadhaar details not found for this checkpoint',
                });
                return;
            }

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
        } catch (error) {
            logger.error('Error retrieving Aadhaar details:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving Aadhaar details',
            });
        }
    },

    /**
     * Handle bank verification page
     */
    async handleBankVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
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

                // In a production system, you would have a bank_ifsc table or API service
                // to lookup bank names and branches from IFSC codes
                // For now, we'll extract bank code from IFSC (first 4 characters)
                const bankCode = account.ifsc_code.substring(0, 4);

                // The branch code is typically characters 5-11 in IFSC
                const branchCode = account.ifsc_code.substring(5);

                // Lookup bank information (simulating a lookup with actual bank names)
                const bankMap: Record<string, string> = {
                    HDFC: 'HDFC Bank',
                    ICIC: 'ICICI Bank',
                    SBIN: 'State Bank of India',
                    PUNB: 'Punjab National Bank',
                    AXIS: 'Axis Bank',
                    // Add more bank codes and names as needed
                };

                const bankName = bankMap[bankCode] || `Bank (Code: ${bankCode})`;

                // For account type, we don't have this information in the schema
                // In a real app, you'd have this information stored somewhere
                const accountType = 'Savings'; // Default assumption

                // For verification method, we don't have this in the schema
                // In a real app, this would be stored with the verification details
                const verificationMethod = 'Penny Drop'; // Default assumption

                return {
                    bank_id: account.bank_id,
                    account_number: account.account_no,
                    holder_name: holderName,
                    ifsc_code: account.ifsc_code,
                    bank_name: bankName,
                    branch: `Branch (Code: ${branchCode})`,
                    account_type: accountType,
                    verification_status: account.verification,
                    verification_method: verificationMethod,
                    is_primary: account.is_primary,
                };
            });

            const formattedBankAccounts = await Promise.all(formattedBankAccountsPromises);

            res.status(OK).json({
                success: true,
                data: {
                    bankAccounts: formattedBankAccounts,
                },
            });
        } catch (error) {
            logger.error('Error handling bank verification:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving bank verification details',
            });
        }
    },
    /**
     * Handle address verification page
     */
    async handleAddressVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
            // First get the checkpoint to find address_id
            const checkpoint = await db
                .selectFrom('signup_checkpoints')
                .select(['address_id', 'aadhaar_id'])
                .where('id', '=', checkpointId)
                .executeTakeFirst();

            if (!checkpoint) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'Checkpoint not found',
                });
                return;
            }

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
                .executeTakeFirst();

            if (!addressDetails) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'Address details not found',
                });
                return;
            }

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
        } catch (error) {
            logger.error('Error handling address verification:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving address verification details',
            });
        }
    },

    /**
     * Handle signature verification page
     */
    async handleSignatureVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
            // Get signature details from signup_checkpoints
            const signatureDetails = await db
                .selectFrom('signup_checkpoints')
                .select(['id as checkpoint_id', 'signature', 'updated_at', 'created_at'])
                .where('id', '=', checkpointId)
                .executeTakeFirst();

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
        } catch (error) {
            logger.error('Error handling signature verification:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving signature verification details',
            });
        }
    },

    /**
     * Handle IPV (In-Person Verification) page
     */
    async handleIPVVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
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
        } catch (error) {
            logger.error('Error handling IPV verification:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving IPV verification details',
            });
        }
    },

    /**
     * Handle trading preferences page
     */
    async handleTradingPreferences(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
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
                .executeTakeFirst();

            if (!checkpointDetails) {
                res.status(NOT_FOUND).json({
                    success: false,
                    message: 'Checkpoint not found',
                });
                return;
            }

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
        } catch (error) {
            logger.error('Error handling trading preferences:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving trading preferences',
            });
        }
    },

    /**
     * Handle nominee verification page
     */
    async handleNomineeVerification(checkpointId: number, data: any, res: Response): Promise<void> {
        try {
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
        } catch (error) {
            logger.error('Error handling nominee verification:', error);
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error retrieving nominee details',
            });
        }
    },
    /**
     * Handle other documents page (not implememnted )
     */
    // async handleOtherDocuments(checkpointId: number, data: any, res: Response): Promise<void> {},

    /**
     * Handle e-sign verification page (not implemented)
     */
    // async handleEsignVerification(checkpointId: number, data: any, res: Response): Promise<void> {},
    /**
     * Simple controller to update verification status
     * Only updates the verification_status table and nothing else
     */
    async updateVerificationStatus(req: Request, res: Response): Promise<Response> {
        try {
            const checkpointId = Number(req.params.checkpointId);
            const { verificationType, status } = req.body;

            // Validate inputs
            if (!verificationType) {
                return res.status(400).json({
                    success: false,
                    message: 'Verification type is required',
                });
            }

            if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid status is required (approved, rejected, or pending)',
                });
            }

            // Use a more explicit approach with the ref function
            const checkpointIdColumn = db.dynamic.ref('checkpoint_id');
            const idColumn = db.dynamic.ref('id');

            // Check if verification record exists for this checkpoint
            const verificationRecord = await db
                .selectFrom('verification_status')
                .select([idColumn])
                .where(checkpointIdColumn, '=', checkpointId)
                .executeTakeFirst();

            const statusFieldName = `${verificationType}_status`;
            const now = new Date();

            if (verificationRecord) {
                // Update existing record
                await db
                    .updateTable('verification_status')
                    .set({
                        [statusFieldName]: status,
                        updated_at: now,
                    })
                    .where(idColumn, '=', verificationRecord.id)
                    .execute();
            } else {
                // Create new record with all statuses as pending, except the one being updated
                const initialStatuses = {
                    pan_status: 'pending',
                    aadhaar_status: 'pending',
                    bank_status: 'pending',
                    address_status: 'pending',
                    signature_status: 'pending',
                    ipv_status: 'pending',
                    front_office_status: 'pending',
                    trading_preferences_status: 'pending',
                    nominee_status: 'pending',
                    other_documents_status: 'pending',
                    esign_status: 'pending',
                    [statusFieldName]: status,
                    checkpoint_id: checkpointId,
                    created_at: now,
                    updated_at: now,
                };

                await db.insertInto('verification_status').values(initialStatuses).execute();
            }

            return res.status(200).json({
                success: true,
                message: `${verificationType} verification status updated to ${status}`,
            });
        } catch (error) {
            logger.error(`Error updating verification status:`, error);
            return res.status(500).json({
                success: false,
                message: `Error updating verification status: ${(error as Error).message}`,
            });
        }
    },

    /**
     * Get verification status for a checkpoint
     */
    async getVerificationStatus(req: Request, res: Response): Promise<Response> {
        try {
            const checkpointId = Number(req.params.checkpointId);

            // Use dynamic references to avoid type errors
            const checkpointIdColumn = db.dynamic.ref('checkpoint_id');

            // Get verification status
            const verificationStatus = await db
                .selectFrom('verification_status')
                .selectAll()
                .where(checkpointIdColumn, '=', checkpointId)
                .executeTakeFirst();

            if (!verificationStatus) {
                // No verification status found, return default pending values
                return res.status(200).json({
                    success: true,
                    data: {
                        pan_status: 'pending',
                        aadhaar_status: 'pending',
                        bank_status: 'pending',
                        address_status: 'pending',
                        signature_status: 'pending',
                        ipv_status: 'pending',
                        front_office_status: 'pending',
                        trading_preferences_status: 'pending',
                        nominee_status: 'pending',
                        other_documents_status: 'pending',
                        esign_status: 'pending',
                    },
                });
            }

            return res.status(200).json({
                success: true,
                data: verificationStatus,
            });
        } catch (error) {
            logger.error('Error getting verification status:', error);
            return res.status(500).json({
                success: false,
                message: `Error retrieving verification status: ${(error as Error).message}`,
            });
        }
    },
};

export default complianceController;
