// src/services/pdf-data-fetcher.service.ts

import { db } from '@app/database';
import logger from '@app/logger';
import { UserData } from './pdf.types';
import AOFService from '../aof.service';
import PDFGenerationService from './pdf-generator';
import { customFormFields, defaultPageSections } from './pdf.types';

/**
 * Service to fetch user data from signup_checkpoints and format it for PDF generation
 */
class PDFDataFetcherService {
    /**
     * Fetch user data from signup_checkpoints table
     */
    public async fetchSignupDataForPDF(email: string): Promise<UserData> {
        try {
            logger.info(`Fetching signup checkpoint data for PDF generation: ${email}`);

            const signupData = await db
                .selectFrom('signup_checkpoints')
                .leftJoin('user_name as user_name_table', 'signup_checkpoints.name', 'user_name_table.id')
                .leftJoin(
                    'user_name as father_spouse_name_table',
                    'signup_checkpoints.father_spouse_name',
                    'father_spouse_name_table.id',
                )
                .leftJoin('user_name as mother_name_table', 'signup_checkpoints.mother_name', 'mother_name_table.id')
                .leftJoin('user_name as maiden_name_table', 'signup_checkpoints.maiden_name', 'maiden_name_table.id')
                .leftJoin(
                    'user_name as user_provided_name_table',
                    'signup_checkpoints.user_provided_name',
                    'user_provided_name_table.id',
                )
                .innerJoin('phone_number', 'signup_checkpoints.phone_id', 'phone_number.id')
                .leftJoin('pan_detail', 'signup_checkpoints.pan_id', 'pan_detail.id')
                .leftJoin('aadhaar_detail', 'signup_checkpoints.aadhaar_id', 'aadhaar_detail.id')
                .leftJoin('user_name as co_name_table', 'aadhaar_detail.co', 'co_name_table.id')
                .leftJoin(
                    'address as permanent_address',
                    'signup_checkpoints.permanent_address_id',
                    'permanent_address.id',
                )
                .leftJoin('city as permanent_city', 'permanent_address.city_id', 'permanent_city.id')
                .leftJoin('state as permanent_state', 'permanent_city.state_id', 'permanent_state.id')
                .leftJoin('country as permanent_country', 'permanent_state.country_id', 'permanent_country.iso')
                .leftJoin('postal_code as permanent_postal', 'permanent_address.postal_id', 'permanent_postal.id')
                .leftJoin(
                    'address as correspondence_address',
                    'signup_checkpoints.correspondence_address_id',
                    'correspondence_address.id',
                )
                .leftJoin('city as correspondence_city', 'correspondence_address.city_id', 'correspondence_city.id')
                .leftJoin('state as correspondence_state', 'correspondence_city.state_id', 'correspondence_state.id')
                .leftJoin(
                    'country as correspondence_country',
                    'correspondence_state.country_id',
                    'correspondence_country.iso',
                )
                .leftJoin(
                    'postal_code as correspondence_postal',
                    'correspondence_address.postal_id',
                    'correspondence_postal.id',
                )
                .leftJoin('demat_account', 'signup_checkpoints.demat_account_id', 'demat_account.id')
                .leftJoin('user_name as demat_client_name', 'demat_account.client_name', 'demat_client_name.id')
                .select([
                    // Basic Information
                    'signup_checkpoints.client_id as clientId',
                    'signup_checkpoints.email',
                    'signup_checkpoints.created_at',
                    'signup_checkpoints.doubt',

                    // Name Information
                    'user_name_table.first_name as firstName',
                    'user_name_table.middle_name as middleName',
                    'user_name_table.last_name as lastName',
                    'father_spouse_name_table.first_name as fatherSpouseFirstName',
                    'father_spouse_name_table.middle_name as fatherSpouseMiddleName',
                    'father_spouse_name_table.last_name as fatherSpouseLastName',
                    'mother_name_table.first_name as motherFirstName',
                    'mother_name_table.middle_name as motherMiddleName',
                    'mother_name_table.last_name as motherLastName',
                    'maiden_name_table.first_name as maidenFirstName',
                    'maiden_name_table.middle_name as maidenMiddleName',
                    'maiden_name_table.last_name as maidenLastName',
                    'user_provided_name_table.first_name as userProvidedFirstName',
                    'user_provided_name_table.middle_name as userProvidedMiddleName',
                    'user_provided_name_table.last_name as userProvidedLastName',

                    // Personal Details
                    'signup_checkpoints.dob',
                    'signup_checkpoints.user_provided_dob as userProvidedDob',
                    'signup_checkpoints.marital_status as maritalStatus',
                    'aadhaar_detail.gender',

                    // Contact Information
                    'phone_number.phone',
                    'signup_checkpoints.office_tel_num as officeTelNum',
                    'signup_checkpoints.residence_tel_num as residenceTelNum',

                    // Permanent Address
                    'permanent_address.line_1 as permanentLine1',
                    'permanent_address.line_2 as permanentLine2',
                    'permanent_address.line_3 as permanentLine3',
                    'permanent_city.name as permanentCity',
                    'permanent_state.name as permanentState',
                    'permanent_postal.postal_code as permanentPinCode',
                    'permanent_country.name as permanentCountry',
                    'permanent_address.address_type as permanentAddressType',

                    // Correspondence Address
                    'correspondence_address.line_1 as correspondenceLine1',
                    'correspondence_address.line_2 as correspondenceLine2',
                    'correspondence_address.line_3 as correspondenceLine3',
                    'correspondence_city.name as correspondenceCity',
                    'correspondence_state.name as correspondenceState',
                    'correspondence_postal.postal_code as correspondencePinCode',
                    'correspondence_country.name as correspondenceCountry',
                    'correspondence_address.address_type as correspondenceAddressType',

                    // PAN & Aadhaar
                    'pan_detail.pan_number as panNumber',
                    'signup_checkpoints.pan_document',
                    'signup_checkpoints.pan_document_issuer as panDocumentIssuer',
                    'pan_detail.category as panCategory',
                    'pan_detail.status as panStatus',
                    'pan_detail.aadhaar_linked as aadhaarLinked',
                    'pan_detail.masked_aadhaar as maskedAadhaar',
                    'aadhaar_detail.masked_aadhaar_no as maskedAadhaarNo',
                    'co_name_table.full_name as coName',
                    'aadhaar_detail.post_office as postOffice',

                    // Financial Information
                    'signup_checkpoints.annual_income as annualIncome',
                    'signup_checkpoints.occupation',
                    'signup_checkpoints.trading_exp as tradingExp',
                    'signup_checkpoints.income_proof_type as incomeProofType',
                    'signup_checkpoints.income_proof',

                    // Investment & Trading
                    'signup_checkpoints.account_settlement as accountSettlement',
                    'signup_checkpoints.is_politically_exposed as isPoliticallyExposed',

                    // Demat Account
                    'demat_account.bo_id as boId',
                    'demat_account.dp_id as dpId',
                    'demat_account.depository',
                    'demat_account.dp_name as dpName',
                    'demat_client_name.full_name as clientName',

                    // Documents
                    'signup_checkpoints.signature',
                    'signup_checkpoints.esign',
                    'signup_checkpoints.ipv',
                ])
                .where('signup_checkpoints.email', '=', email)
                .executeTakeFirstOrThrow();

            // Fetch bank account from checkpoint
            const bankAccount = await db
                .selectFrom('bank_to_checkpoint')
                .innerJoin('bank_account', 'bank_to_checkpoint.bank_account_id', 'bank_account.id')
                .innerJoin('signup_checkpoints', 'bank_to_checkpoint.checkpoint_id', 'signup_checkpoints.id')
                .select([
                    'bank_account.account_no as accountNo',
                    'bank_account.ifsc_code as ifscCode',
                    'bank_account.account_type as accountType',
                    'bank_to_checkpoint.is_primary as isPrimaryBank',
                    'bank_account.verification as bankVerification',
                ])
                .where('signup_checkpoints.email', '=', email)
                .executeTakeFirst();

            // Fetch investment segments from checkpoint
            const investmentSegments = await db
                .selectFrom('investment_segments_to_checkpoint')
                .innerJoin(
                    'signup_checkpoints',
                    'investment_segments_to_checkpoint.checkpoint_id',
                    'signup_checkpoints.id',
                )
                .select('segment')
                .where('signup_checkpoints.email', '=', email)
                .execute();

            // Fetch nominees from checkpoint
            const nominees = await db
                .selectFrom('nominees_to_checkpoint')
                .innerJoin('signup_checkpoints', 'nominees_to_checkpoint.checkpoint_id', 'signup_checkpoints.id')
                .innerJoin('nominees', 'nominees_to_checkpoint.nominees_id', 'nominees.id')
                .innerJoin('user_name as nominee_name', 'nominees.name', 'nominee_name.id')
                .select([
                    'nominee_name.full_name as name',
                    'nominees.relationship',
                    'nominees.share',
                    'nominees.govt_id',
                ])
                .where('signup_checkpoints.email', '=', email)
                .execute();

            // Format data for PDF generation
            const formattedData: UserData = {
                // Basic Information
                formNo: await new AOFService().generateNextAOFNumber(),
                clientId: signupData.clientId || 'PENDING',
                date: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY format

                // Name Information
                firstName: signupData.firstName || '',
                middleName: signupData.middleName || '',
                lastName: signupData.lastName || '',
                fatherSpouseFirstName: signupData.fatherSpouseFirstName || '',
                fatherSpouseMiddleName: signupData.fatherSpouseMiddleName || '',
                fatherSpouseLastName: signupData.fatherSpouseLastName || '',
                motherFirstName: signupData.motherFirstName || '',
                motherMiddleName: signupData.motherMiddleName || '',
                motherLastName: signupData.motherLastName || '',
                maidenFirstName: signupData.maidenFirstName || '',
                maidenMiddleName: signupData.maidenMiddleName || '',
                maidenLastName: signupData.maidenLastName || '',

                // Personal Details
                dob: signupData.dob ? new Date(signupData.dob).toLocaleDateString('en-GB') : '',
                userProvidedDob: signupData.userProvidedDob
                    ? new Date(signupData.userProvidedDob).toLocaleDateString('en-GB')
                    : '',
                gender: signupData.gender as any,
                maritalStatus: signupData.maritalStatus as any,

                // Nationality & Citizenship (set defaults for signup)
                nationality: 'INDIAN',
                otherNationality: '',
                countryOfCitizenship: 'INDIA',
                countryOfResidence: 'INDIA',
                residentialStatus: 'Resident Individual',

                // Contact Information
                email: signupData.email,
                phone: signupData.phone || '',
                officeTelNum: signupData.officeTelNum || '',
                residenceTelNum: signupData.residenceTelNum || '',

                // Permanent Address
                permanentLine1: signupData.permanentLine1 || '',
                permanentLine2: signupData.permanentLine2 || '',
                permanentLine3: signupData.permanentLine3 || '',
                permanentCity: signupData.permanentCity || '',
                permanentState: signupData.permanentState || '',
                permanentPinCode: signupData.permanentPinCode || '',
                permanentCountry: signupData.permanentCountry || 'INDIA',
                permanentAddressType: (signupData.permanentAddressType as any) || 'Residential',

                // Correspondence Address
                sameAsPermanent: !signupData.correspondenceLine1, // If no correspondence address, same as permanent
                correspondenceLine1: signupData.correspondenceLine1 || '',
                correspondenceLine2: signupData.correspondenceLine2 || '',
                correspondenceLine3: signupData.correspondenceLine3 || '',
                correspondenceCity: signupData.correspondenceCity || '',
                correspondenceState: signupData.correspondenceState || '',
                correspondencePinCode: signupData.correspondencePinCode || '',
                correspondenceCountry: signupData.correspondenceCountry || '',
                correspondenceAddressType: signupData.correspondenceAddressType as any,

                // PAN & Aadhaar
                panNumber: signupData.panNumber || '',
                panDocument: signupData.pan_document || '',
                panDocumentIssuer: signupData.panDocumentIssuer || '',
                panCategory: signupData.panCategory || '',
                panStatus: signupData.panStatus || '',
                aadhaarLinked: signupData.aadhaarLinked ? 'YES' : 'NO',
                maskedAadhaar: signupData.maskedAadhaar ? `XXXXXXXX${signupData.maskedAadhaar}` : '',
                maskedAadhaarNo: signupData.maskedAadhaarNo ? `XXXXXXXX${signupData.maskedAadhaarNo}` : '',
                co: signupData.coName || '',
                postOffice: signupData.postOffice || '',

                // Banking
                accountNo: bankAccount?.accountNo || '',
                ifscCode: bankAccount?.ifscCode || '',
                accountType: bankAccount?.accountType as any,
                isPrimaryBank: bankAccount?.isPrimaryBank || false,
                bankVerification: bankAccount?.bankVerification as any,

                // Demat
                boId: signupData.boId || '',
                dpId: signupData.dpId || '',
                depository: signupData.depository as any,
                dpName: signupData.dpName || '',
                clientName: signupData.clientName || '',

                // Financial Information
                annualIncome: signupData.annualIncome as any,
                occupation: signupData.occupation as any,
                tradingExp: signupData.tradingExp as any,
                incomeProofType: signupData.incomeProofType as any,
                incomeProof: signupData.income_proof || '',

                // Investment Preferences
                investmentSegments: investmentSegments.map((s) => s.segment) as any[],
                accountSettlement: signupData.accountSettlement as any,
                dpAccountSettlement: 'Monthly', // Default for signup
                fundsSettlementFrequency: '30_days', // Default for signup

                // Trading Facilities
                internetTradingFacility: 'YES',
                marginTradingFacility: 'NO',
                disFacility: 'YES',
                bsdaFacility: 'NO',
                annualReportType: 'Electronic',
                contractNoteType: 'Electronic',
                emailWithRegistrar: 'YES',

                // Compliance
                userAccountType: 'Individual',
                businessCategorization: 'D2C',
                clientCategoryCommercialNonCommercial: 'Trader',
                isPoliticallyExposed: signupData.isPoliticallyExposed ? 'YES' : 'NO',
                isUsPerson: 'NO',
                pastActions: 'NO',

                // Declarations
                emailDeclaration: 'Self',
                mobileDeclaration: 'Self',

                // Nominees
                nominee1Name: nominees[0]?.name || '',
                nominee1Relationship: nominees[0]?.relationship as any,
                nominee1Share: nominees[0]?.share || 0,
                nominee1GovtId: nominees[0]?.govt_id || '',
                nominee2Name: nominees[1]?.name || '',
                nominee2Relationship: nominees[1]?.relationship as any,
                nominee2Share: nominees[1]?.share || 0,
                nominee2GovtId: nominees[1]?.govt_id || '',
                nominee3Name: nominees[2]?.name || '',
                nominee3Relationship: nominees[2]?.relationship as any,
                nominee3Share: nominees[2]?.share || 0,
                nominee3GovtId: nominees[2]?.govt_id || '',

                // GST Registration (empty for signup)
                gstRegisterNo: '',
                gstStateName: '',
                gstValidityDate: '',

                // User Preferences (set defaults for signup)
                chartProvider: 'TradingView',
                biometricPermission: true,
                internetPermission: true,
                notificationPermission: true,
                orderNotifications: true,
                tradeNotifications: true,
                promotionNotifications: false,
                tradeRecommendations: true,

                // Documents
                signature: signupData.signature || '',
                esign: signupData.esign || '',
                ipv: signupData.ipv || '',
                profilePicture: '',
            };

            logger.info(`Successfully fetched signup data for PDF generation: ${email}`);
            return formattedData;
        } catch (error: any) {
            logger.error(`Error fetching signup data for PDF generation: ${email}`, error);
            throw new Error(`Failed to fetch signup data: ${error.message}`);
        }
    }

    /**
     * Fetch user data from completed user table
     */
    public async fetchCompletedUserDataForPDF(clientId: string): Promise<UserData> {
        try {
            logger.info(`Fetching completed user data for PDF generation: ${clientId}`);
            throw new Error('Method not implemented - use fetchSignupDataForPDF for signup process data');
        } catch (error: any) {
            logger.error(`Error fetching completed user data for PDF generation: ${clientId}`, error);
            throw new Error(`Failed to fetch completed user data: ${error.message}`);
        }
    }

    /**
     * Generate PDF for a user based on their email
     */
    public async generateUserPDF(email: string, outputFileName?: string) {
        const userData = await this.fetchSignupDataForPDF(email);

        return PDFGenerationService.generatePDF(
            userData,
            customFormFields,
            userData.clientId || undefined,
            defaultPageSections,
        );
    }
}

export default new PDFDataFetcherService();
