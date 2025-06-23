// src/services/notification-types/pdf.types.ts

/**
 * PDF Generation Types and Interfaces
 * Complete type definitions for the PDF generation service
 */

// ===== CORE INTERFACES =====

export interface PDFGenerationResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fieldsTotal?: number;
    fieldsFilled?: number;
    pages?: number;
    error?: string;
}

export interface FormField {
    label: string;
    key: string;
    x: number;
    y: number;
    page: number;
    required: boolean;
    type: FormFieldType;
    table?: string;
    conditional?: ConditionalType;
    options?: string[];
}

export interface PDFColors {
    primary: { r: number; g: number; b: number };
    secondary: { r: number; g: number; b: number };
    text: { r: number; g: number; b: number };
    accent: { r: number; g: number; b: number };
    border: { r: number; g: number; b: number };
}

export interface PageSection {
    title: string;
    fields: string[];
}

export interface FormStatistics {
    totalFields: number;
    requiredFields: number;
    filledFields: number;
    filledRequiredFields: number;
    completionPercentage: number;
}

// ===== ENUMS AND TYPES =====

export type FormFieldType =
    | 'text'
    | 'email'
    | 'tel'
    | 'date'
    | 'number'
    | 'select'
    | 'multi-select'
    | 'checkbox'
    | 'file';

export type ConditionalType = 'married_female' | 'other_nationality' | 'different_address';

export type AddressType = 'Residential' | 'Business' | 'Unspecified';

export type Gender = 'Male' | 'Female' | 'Other';

export type MaritalStatus = 'Single' | 'Married' | 'Divorced';

export type Nationality = 'INDIAN' | 'OTHER';

export type Country = 'INDIA' | 'OTHER';

export type ResidentialStatus = 'Resident Individual' | 'NRI' | 'Person of Indian Origin' | 'Foreign Nation';

export type AccountType = 'savings' | 'current';

export type BankVerificationStatus = 'pending' | 'verified' | 'failed';

export type Depository = 'CDSL' | 'NSDL';

export type AnnualIncome = 'le_1_Lakh' | '1_5_Lakh' | '5_10_Lakh' | '10_25_Lakh' | '25_1_Cr' | 'Ge_1_Cr';

export type Occupation =
    | 'student'
    | 'housewife'
    | 'self employed'
    | 'private sector'
    | 'govt servant'
    | 'retired'
    | 'agriculturalist'
    | 'other';

export type TradingExperience = '1' | '1-5' | '5-10' | '10';

export type IncomeProofType =
    | 'salary_slip_15k_monthly'
    | 'form_16_120k_annual'
    | 'bank_statement_6m_10k'
    | 'demat_statement_10k_holdings'
    | 'net_worth_certificate_10l';

export type InvestmentSegment = 'Cash' | 'F&O' | 'Currency' | 'Commodity' | 'Debt';

export type SettlementFrequency = 'Monthly' | 'Quarterly' | 'Weekly' | 'Fortnightly' | 'As per SEBI regulations';

export type FundsSettlementFrequency = '30_days' | '90_days' | 'bill_to_bill';

export type YesNoOption = 'YES' | 'NO';

export type ReportType = 'Electronic' | 'Physical' | 'Both';

export type UserAccountType = 'Individual' | 'Non-Individual';

export type BusinessCategorization = 'B2B' | 'D2C';

export type ClientCategory =
    | 'Trader'
    | 'Hedger'
    | 'Arbitrager'
    | 'Exporter'
    | 'Importer'
    | 'Financial Participation'
    | 'Value Chain Participation'
    | 'Other';

export type DeclarationType = 'Self' | 'Parent' | 'Child' | 'Spouse' | 'Do not have';

export type NomineeRelationship = 'Father' | 'Mother' | 'Son' | 'Daughter' | 'Spouse' | 'Brother' | 'Sister' | 'Other';

export type ChartProvider = 'TradingView' | 'ChartIQ';

// ===== USER DATA INTERFACE =====

export interface UserData {
    // Basic Information
    formNo?: string;
    clientId?: string;
    date?: string;

    // Name Information
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fatherSpouseFirstName?: string;
    fatherSpouseMiddleName?: string;
    fatherSpouseLastName?: string;
    motherFirstName?: string;
    motherMiddleName?: string;
    motherLastName?: string;
    maidenFirstName?: string;
    maidenMiddleName?: string;
    maidenLastName?: string;

    // Personal Details
    dob?: string;
    userProvidedDob?: string;
    gender?: Gender;
    maritalStatus?: MaritalStatus;

    // Nationality & Citizenship
    nationality?: Nationality;
    otherNationality?: string;
    countryOfCitizenship?: Country;
    countryOfResidence?: Country;
    residentialStatus?: ResidentialStatus;

    // Contact Information
    email?: string;
    phone?: string;
    officeTelNum?: string;
    residenceTelNum?: string;

    // Permanent Address
    permanentLine1?: string;
    permanentLine2?: string;
    permanentLine3?: string;
    permanentCity?: string;
    permanentState?: string;
    permanentPinCode?: string;
    permanentCountry?: string;
    permanentAddressType?: AddressType;

    // Correspondence Address
    sameAsPermanent?: boolean;
    correspondenceLine1?: string;
    correspondenceLine2?: string;
    correspondenceLine3?: string;
    correspondenceCity?: string;
    correspondenceState?: string;
    correspondencePinCode?: string;
    correspondenceCountry?: string;
    correspondenceAddressType?: AddressType;

    // PAN & Aadhaar
    panNumber?: string;
    panDocument?: string;
    panDocumentIssuer?: string;
    panCategory?: string;
    panStatus?: string;
    aadhaarLinked?: YesNoOption;
    maskedAadhaar?: string;
    maskedAadhaarNo?: string;
    co?: string;
    postOffice?: string;

    // Banking
    accountNo?: string;
    ifscCode?: string;
    accountType?: AccountType;
    isPrimaryBank?: boolean;
    bankVerification?: BankVerificationStatus;

    // Demat
    boId?: string;
    dpId?: string;
    depository?: Depository;
    dpName?: string;
    clientName?: string;

    // Financial Information
    annualIncome?: AnnualIncome;
    occupation?: Occupation;
    tradingExp?: TradingExperience;
    incomeProofType?: IncomeProofType;
    incomeProof?: string;

    // Investment Preferences
    investmentSegments?: InvestmentSegment[];
    accountSettlement?: SettlementFrequency;
    dpAccountSettlement?: SettlementFrequency;
    fundsSettlementFrequency?: FundsSettlementFrequency;

    // Trading Facilities
    internetTradingFacility?: YesNoOption;
    marginTradingFacility?: YesNoOption;
    disFacility?: YesNoOption;
    bsdaFacility?: YesNoOption;
    annualReportType?: ReportType;
    contractNoteType?: Omit<ReportType, 'Both'>;
    emailWithRegistrar?: YesNoOption;

    // Compliance
    userAccountType?: UserAccountType;
    businessCategorization?: BusinessCategorization;
    clientCategoryCommercialNonCommercial?: ClientCategory;
    isPoliticallyExposed?: YesNoOption;
    isUsPerson?: YesNoOption;
    pastActions?: YesNoOption;

    // Declarations
    emailDeclaration?: DeclarationType;
    mobileDeclaration?: Omit<DeclarationType, 'Do not have'>;

    // Nominees
    nominee1Name?: string;
    nominee1Relationship?: NomineeRelationship;
    nominee1Share?: number;
    nominee1GovtId?: string;
    nominee2Name?: string;
    nominee2Relationship?: NomineeRelationship;
    nominee2Share?: number;
    nominee2GovtId?: string;
    nominee3Name?: string;
    nominee3Relationship?: NomineeRelationship;
    nominee3Share?: number;
    nominee3GovtId?: string;

    // GST Registration
    gstRegisterNo?: string;
    gstStateName?: string;
    gstValidityDate?: string;

    // User Preferences
    chartProvider?: ChartProvider;
    biometricPermission?: boolean;
    internetPermission?: boolean;
    notificationPermission?: boolean;
    orderNotifications?: boolean;
    tradeNotifications?: boolean;
    promotionNotifications?: boolean;
    tradeRecommendations?: boolean;

    // Documents
    signature?: string;
    esign?: string;
    ipv?: string;
    profilePicture?: string;
}

// ===== CUSTOM FORM FIELDS =====

export const customFormFields: FormField[] = [
    // Page 1 - Personal Information
    { label: 'Form Number', key: 'formNo', x: 150, y: 750, page: 0, required: true, type: 'text' },
    { label: 'Client ID', key: 'clientId', x: 400, y: 750, page: 0, required: true, type: 'text' },
    { label: 'Date', key: 'date', x: 150, y: 720, page: 0, required: true, type: 'date' },

    // Name Information (user_name table)
    {
        label: 'First Name',
        key: 'firstName',
        x: 150,
        y: 680,
        page: 0,
        required: true,
        type: 'text',
        table: 'user_name',
    },
    {
        label: 'Middle Name',
        key: 'middleName',
        x: 300,
        y: 680,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
    },
    { label: 'Last Name', key: 'lastName', x: 450, y: 680, page: 0, required: true, type: 'text', table: 'user_name' },

    // Father/Spouse Name (user_name table)
    {
        label: 'Father/Spouse First Name',
        key: 'fatherSpouseFirstName',
        x: 150,
        y: 650,
        page: 0,
        required: true,
        type: 'text',
        table: 'user_name',
    },
    {
        label: 'Father/Spouse Middle Name',
        key: 'fatherSpouseMiddleName',
        x: 300,
        y: 650,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
    },
    {
        label: 'Father/Spouse Last Name',
        key: 'fatherSpouseLastName',
        x: 450,
        y: 650,
        page: 0,
        required: true,
        type: 'text',
        table: 'user_name',
    },

    // Mother Name (user_name table)
    {
        label: 'Mother First Name',
        key: 'motherFirstName',
        x: 150,
        y: 620,
        page: 0,
        required: true,
        type: 'text',
        table: 'user_name',
    },
    {
        label: 'Mother Middle Name',
        key: 'motherMiddleName',
        x: 300,
        y: 620,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
    },
    {
        label: 'Mother Last Name',
        key: 'motherLastName',
        x: 450,
        y: 620,
        page: 0,
        required: true,
        type: 'text',
        table: 'user_name',
    },

    // Maiden Name (user_name table) - conditional
    {
        label: 'Maiden First Name',
        key: 'maidenFirstName',
        x: 150,
        y: 590,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
        conditional: 'married_female',
    },
    {
        label: 'Maiden Middle Name',
        key: 'maidenMiddleName',
        x: 300,
        y: 590,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
        conditional: 'married_female',
    },
    {
        label: 'Maiden Last Name',
        key: 'maidenLastName',
        x: 450,
        y: 590,
        page: 0,
        required: false,
        type: 'text',
        table: 'user_name',
        conditional: 'married_female',
    },

    // Personal Details
    { label: 'Date of Birth', key: 'dob', x: 150, y: 560, page: 0, required: true, type: 'date', table: 'user' },
    {
        label: 'User Provided DOB',
        key: 'userProvidedDob',
        x: 400,
        y: 560,
        page: 0,
        required: true,
        type: 'date',
        table: 'signup_checkpoints',
    },
    {
        label: 'Gender',
        key: 'gender',
        x: 150,
        y: 530,
        page: 0,
        required: true,
        type: 'select',
        options: ['Male', 'Female', 'Other'],
        table: 'aadhaar_detail',
    },
    {
        label: 'Marital Status',
        key: 'maritalStatus',
        x: 300,
        y: 530,
        page: 0,
        required: true,
        type: 'select',
        options: ['Single', 'Married', 'Divorced'],
        table: 'user',
    },

    // Nationality & Citizenship
    {
        label: 'Nationality',
        key: 'nationality',
        x: 150,
        y: 500,
        page: 0,
        required: true,
        type: 'select',
        options: ['INDIAN', 'OTHER'],
        table: 'user',
    },
    {
        label: 'Other Nationality',
        key: 'otherNationality',
        x: 300,
        y: 500,
        page: 0,
        required: false,
        type: 'text',
        table: 'user',
        conditional: 'other_nationality',
    },
    {
        label: 'Country of Citizenship',
        key: 'countryOfCitizenship',
        x: 150,
        y: 470,
        page: 0,
        required: true,
        type: 'select',
        options: ['INDIA', 'OTHER'],
        table: 'user',
    },
    {
        label: 'Country of Residence',
        key: 'countryOfResidence',
        x: 300,
        y: 470,
        page: 0,
        required: true,
        type: 'select',
        options: ['INDIA', 'OTHER'],
        table: 'user',
    },
    {
        label: 'Residential Status',
        key: 'residentialStatus',
        x: 450,
        y: 470,
        page: 0,
        required: true,
        type: 'select',
        options: ['Resident Individual', 'NRI', 'Person of Indian Origin', 'Foreign Nation'],
        table: 'user',
    },

    // Contact Information
    { label: 'Email', key: 'email', x: 150, y: 440, page: 0, required: true, type: 'email', table: 'user' },
    {
        label: 'Phone Number',
        key: 'phone',
        x: 400,
        y: 440,
        page: 0,
        required: true,
        type: 'tel',
        table: 'phone_number',
    },
    {
        label: 'Office Phone',
        key: 'officeTelNum',
        x: 150,
        y: 410,
        page: 0,
        required: false,
        type: 'tel',
        table: 'user',
    },
    {
        label: 'Residence Phone',
        key: 'residenceTelNum',
        x: 400,
        y: 410,
        page: 0,
        required: false,
        type: 'tel',
        table: 'user',
    },

    // Address Information - Permanent (address table)
    {
        label: 'Permanent Address Line 1',
        key: 'permanentLine1',
        x: 150,
        y: 380,
        page: 0,
        required: true,
        type: 'text',
        table: 'address',
    },
    {
        label: 'Permanent Address Line 2',
        key: 'permanentLine2',
        x: 150,
        y: 350,
        page: 0,
        required: false,
        type: 'text',
        table: 'address',
    },
    {
        label: 'Permanent Address Line 3',
        key: 'permanentLine3',
        x: 150,
        y: 320,
        page: 0,
        required: false,
        type: 'text',
        table: 'address',
    },
    {
        label: 'Permanent City',
        key: 'permanentCity',
        x: 150,
        y: 290,
        page: 0,
        required: true,
        type: 'text',
        table: 'city',
    },
    {
        label: 'Permanent State',
        key: 'permanentState',
        x: 300,
        y: 290,
        page: 0,
        required: true,
        type: 'text',
        table: 'state',
    },
    {
        label: 'Permanent PIN Code',
        key: 'permanentPinCode',
        x: 450,
        y: 290,
        page: 0,
        required: true,
        type: 'text',
        table: 'postal_code',
    },
    {
        label: 'Permanent Country',
        key: 'permanentCountry',
        x: 150,
        y: 260,
        page: 0,
        required: true,
        type: 'text',
        table: 'country',
    },
    {
        label: 'Permanent Address Type',
        key: 'permanentAddressType',
        x: 400,
        y: 260,
        page: 0,
        required: true,
        type: 'select',
        options: ['Residential', 'Business', 'Unspecified'],
        table: 'address',
    },

    // Page 2 - Correspondence Address (if different)
    {
        label: 'Same as Permanent Address',
        key: 'sameAsPermanent',
        x: 150,
        y: 750,
        page: 1,
        required: true,
        type: 'checkbox',
    },
    {
        label: 'Correspondence Address Line 1',
        key: 'correspondenceLine1',
        x: 150,
        y: 720,
        page: 1,
        required: false,
        type: 'text',
        table: 'address',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence Address Line 2',
        key: 'correspondenceLine2',
        x: 150,
        y: 690,
        page: 1,
        required: false,
        type: 'text',
        table: 'address',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence Address Line 3',
        key: 'correspondenceLine3',
        x: 150,
        y: 660,
        page: 1,
        required: false,
        type: 'text',
        table: 'address',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence City',
        key: 'correspondenceCity',
        x: 150,
        y: 630,
        page: 1,
        required: false,
        type: 'text',
        table: 'city',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence State',
        key: 'correspondenceState',
        x: 300,
        y: 630,
        page: 1,
        required: false,
        type: 'text',
        table: 'state',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence PIN Code',
        key: 'correspondencePinCode',
        x: 450,
        y: 630,
        page: 1,
        required: false,
        type: 'text',
        table: 'postal_code',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence Country',
        key: 'correspondenceCountry',
        x: 150,
        y: 600,
        page: 1,
        required: false,
        type: 'text',
        table: 'country',
        conditional: 'different_address',
    },
    {
        label: 'Correspondence Address Type',
        key: 'correspondenceAddressType',
        x: 400,
        y: 600,
        page: 1,
        required: false,
        type: 'select',
        options: ['Residential', 'Business', 'Unspecified'],
        table: 'address',
        conditional: 'different_address',
    },

    // Page 3 - PAN & Aadhaar Information
    {
        label: 'PAN Number',
        key: 'panNumber',
        x: 150,
        y: 750,
        page: 2,
        required: true,
        type: 'text',
        table: 'pan_detail',
    },
    { label: 'PAN Document', key: 'panDocument', x: 400, y: 750, page: 2, required: true, type: 'file', table: 'user' },
    {
        label: 'PAN Document Issuer',
        key: 'panDocumentIssuer',
        x: 150,
        y: 720,
        page: 2,
        required: false,
        type: 'text',
        table: 'user',
    },
    {
        label: 'PAN Category',
        key: 'panCategory',
        x: 400,
        y: 720,
        page: 2,
        required: true,
        type: 'text',
        table: 'pan_detail',
    },
    {
        label: 'PAN Status',
        key: 'panStatus',
        x: 150,
        y: 690,
        page: 2,
        required: true,
        type: 'text',
        table: 'pan_detail',
    },
    {
        label: 'Aadhaar Linked',
        key: 'aadhaarLinked',
        x: 400,
        y: 690,
        page: 2,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'pan_detail',
    },
    {
        label: 'Masked Aadhaar',
        key: 'maskedAadhaar',
        x: 150,
        y: 660,
        page: 2,
        required: true,
        type: 'text',
        table: 'pan_detail',
    },
    {
        label: 'Masked Aadhaar Number',
        key: 'maskedAadhaarNo',
        x: 400,
        y: 660,
        page: 2,
        required: true,
        type: 'text',
        table: 'aadhaar_detail',
    },
    {
        label: 'CO (Care Of)',
        key: 'co',
        x: 150,
        y: 630,
        page: 2,
        required: false,
        type: 'text',
        table: 'aadhaar_detail',
    },
    {
        label: 'Post Office',
        key: 'postOffice',
        x: 400,
        y: 630,
        page: 2,
        required: false,
        type: 'text',
        table: 'aadhaar_detail',
    },

    // Page 4 - Banking Information
    {
        label: 'Bank Account Number',
        key: 'accountNo',
        x: 150,
        y: 750,
        page: 3,
        required: true,
        type: 'text',
        table: 'bank_account',
    },
    {
        label: 'IFSC Code',
        key: 'ifscCode',
        x: 400,
        y: 750,
        page: 3,
        required: true,
        type: 'text',
        table: 'bank_account',
    },
    {
        label: 'Account Type',
        key: 'accountType',
        x: 150,
        y: 720,
        page: 3,
        required: true,
        type: 'select',
        options: ['savings', 'current'],
        table: 'bank_account',
    },
    {
        label: 'Is Primary Bank',
        key: 'isPrimaryBank',
        x: 400,
        y: 720,
        page: 3,
        required: true,
        type: 'checkbox',
        table: 'bank_to_user',
    },
    {
        label: 'Bank Verification Status',
        key: 'bankVerification',
        x: 150,
        y: 690,
        page: 3,
        required: true,
        type: 'select',
        options: ['pending', 'verified', 'failed'],
        table: 'bank_account',
    },

    // Page 5 - Demat Information
    { label: 'BO ID', key: 'boId', x: 150, y: 750, page: 4, required: true, type: 'text', table: 'demat_account' },
    { label: 'DP ID', key: 'dpId', x: 400, y: 750, page: 4, required: true, type: 'text', table: 'demat_account' },
    {
        label: 'Depository',
        key: 'depository',
        x: 150,
        y: 720,
        page: 4,
        required: true,
        type: 'select',
        options: ['CDSL', 'NSDL'],
        table: 'demat_account',
    },
    { label: 'DP Name', key: 'dpName', x: 400, y: 720, page: 4, required: true, type: 'text', table: 'demat_account' },
    {
        label: 'Client Name',
        key: 'clientName',
        x: 150,
        y: 690,
        page: 4,
        required: true,
        type: 'text',
        table: 'demat_account',
    },

    // Page 6 - Financial Information
    {
        label: 'Annual Income',
        key: 'annualIncome',
        x: 150,
        y: 750,
        page: 5,
        required: true,
        type: 'select',
        options: ['le_1_Lakh', '1_5_Lakh', '5_10_Lakh', '10_25_Lakh', '25_1_Cr', 'Ge_1_Cr'],
        table: 'user',
    },
    {
        label: 'Occupation',
        key: 'occupation',
        x: 400,
        y: 750,
        page: 5,
        required: true,
        type: 'select',
        options: [
            'student',
            'housewife',
            'self employed',
            'private sector',
            'govt servant',
            'retired',
            'agriculturalist',
            'other',
        ],
        table: 'user',
    },
    {
        label: 'Trading Experience',
        key: 'tradingExp',
        x: 150,
        y: 720,
        page: 5,
        required: true,
        type: 'select',
        options: ['1', '1-5', '5-10', '10'],
        table: 'user',
    },
    {
        label: 'Income Proof Type',
        key: 'incomeProofType',
        x: 400,
        y: 720,
        page: 5,
        required: true,
        type: 'select',
        options: [
            'salary_slip_15k_monthly',
            'form_16_120k_annual',
            'bank_statement_6m_10k',
            'demat_statement_10k_holdings',
            'net_worth_certificate_10l',
        ],
        table: 'user',
    },
    {
        label: 'Income Proof Document',
        key: 'incomeProof',
        x: 150,
        y: 690,
        page: 5,
        required: true,
        type: 'file',
        table: 'signup_checkpoints',
    },

    // Page 7 - Investment Segments & Preferences
    {
        label: 'Investment Segments',
        key: 'investmentSegments',
        x: 150,
        y: 750,
        page: 6,
        required: true,
        type: 'multi-select',
        options: ['Cash', 'F&O', 'Currency', 'Commodity', 'Debt'],
        table: 'investment_segments_to_user',
    },
    {
        label: 'Account Settlement',
        key: 'accountSettlement',
        x: 400,
        y: 750,
        page: 6,
        required: true,
        type: 'select',
        options: ['Monthly', 'Quarterly'],
        table: 'user',
    },
    {
        label: 'DP Account Settlement',
        key: 'dpAccountSettlement',
        x: 150,
        y: 720,
        page: 6,
        required: true,
        type: 'select',
        options: ['Weekly', 'Fortnightly', 'Monthly', 'As per SEBI regulations'],
        table: 'user',
    },
    {
        label: 'Funds Settlement Frequency',
        key: 'fundsSettlementFrequency',
        x: 400,
        y: 720,
        page: 6,
        required: true,
        type: 'select',
        options: ['30_days', '90_days', 'bill_to_bill'],
        table: 'user_settlement_frequency',
    },

    // Page 8 - Trading Facilities & Preferences
    {
        label: 'Internet Trading Facility',
        key: 'internetTradingFacility',
        x: 150,
        y: 750,
        page: 7,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'Margin Trading Facility',
        key: 'marginTradingFacility',
        x: 400,
        y: 750,
        page: 7,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'DIS Facility',
        key: 'disFacility',
        x: 150,
        y: 720,
        page: 7,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'BSDA Facility',
        key: 'bsdaFacility',
        x: 400,
        y: 720,
        page: 7,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'Annual Report Type',
        key: 'annualReportType',
        x: 150,
        y: 690,
        page: 7,
        required: true,
        type: 'select',
        options: ['Electronic', 'Physical', 'Both'],
        table: 'user',
    },
    {
        label: 'Contract Note Type',
        key: 'contractNoteType',
        x: 400,
        y: 690,
        page: 7,
        required: true,
        type: 'select',
        options: ['Electronic', 'Physical'],
        table: 'user',
    },
    {
        label: 'Email with Registrar',
        key: 'emailWithRegistrar',
        x: 150,
        y: 660,
        page: 7,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },

    // Page 9 - Business & Compliance Information
    {
        label: 'User Account Type',
        key: 'userAccountType',
        x: 150,
        y: 750,
        page: 8,
        required: true,
        type: 'select',
        options: ['Individual', 'Non-Individual'],
        table: 'user',
    },
    {
        label: 'Business Categorization',
        key: 'businessCategorization',
        x: 400,
        y: 750,
        page: 8,
        required: true,
        type: 'select',
        options: ['B2B', 'D2C'],
        table: 'user',
    },
    {
        label: 'Client Category',
        key: 'clientCategoryCommercialNonCommercial',
        x: 150,
        y: 720,
        page: 8,
        required: true,
        type: 'select',
        options: [
            'Trader',
            'Hedger',
            'Arbitrager',
            'Exporter',
            'Importer',
            'Financial Participation',
            'Value Chain Participation',
            'Other',
        ],
        table: 'user',
    },
    {
        label: 'Is Politically Exposed',
        key: 'isPoliticallyExposed',
        x: 400,
        y: 720,
        page: 8,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'Is US Person',
        key: 'isUsPerson',
        x: 150,
        y: 690,
        page: 8,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },
    {
        label: 'Past Actions',
        key: 'pastActions',
        x: 400,
        y: 690,
        page: 8,
        required: true,
        type: 'select',
        options: ['YES', 'NO'],
        table: 'user',
    },

    // Page 10 - Declarations & Contact Preferences
    {
        label: 'Email Declaration',
        key: 'emailDeclaration',
        x: 150,
        y: 750,
        page: 9,
        required: true,
        type: 'select',
        options: ['Self', 'Parent', 'Child', 'Spouse', 'Do not have'],
        table: 'user',
    },
    {
        label: 'Mobile Declaration',
        key: 'mobileDeclaration',
        x: 400,
        y: 750,
        page: 9,
        required: true,
        type: 'select',
        options: ['Self', 'Parent', 'Child', 'Spouse'],
        table: 'user',
    },

    // Page 11 - Nominees Information
    {
        label: 'Nominee 1 Name',
        key: 'nominee1Name',
        x: 150,
        y: 750,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },
    {
        label: 'Nominee 1 Relationship',
        key: 'nominee1Relationship',
        x: 400,
        y: 750,
        page: 10,
        required: false,
        type: 'select',
        options: ['Father', 'Mother', 'Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Other'],
        table: 'nominees',
    },
    {
        label: 'Nominee 1 Share (%)',
        key: 'nominee1Share',
        x: 150,
        y: 720,
        page: 10,
        required: false,
        type: 'number',
        table: 'nominees',
    },
    {
        label: 'Nominee 1 Govt ID',
        key: 'nominee1GovtId',
        x: 400,
        y: 720,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },

    {
        label: 'Nominee 2 Name',
        key: 'nominee2Name',
        x: 150,
        y: 690,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },
    {
        label: 'Nominee 2 Relationship',
        key: 'nominee2Relationship',
        x: 400,
        y: 690,
        page: 10,
        required: false,
        type: 'select',
        options: ['Father', 'Mother', 'Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Other'],
        table: 'nominees',
    },
    {
        label: 'Nominee 2 Share (%)',
        key: 'nominee2Share',
        x: 150,
        y: 660,
        page: 10,
        required: false,
        type: 'number',
        table: 'nominees',
    },
    {
        label: 'Nominee 2 Govt ID',
        key: 'nominee2GovtId',
        x: 400,
        y: 660,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },

    {
        label: 'Nominee 3 Name',
        key: 'nominee3Name',
        x: 150,
        y: 630,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },
    {
        label: 'Nominee 3 Relationship',
        key: 'nominee3Relationship',
        x: 400,
        y: 630,
        page: 10,
        required: false,
        type: 'select',
        options: ['Father', 'Mother', 'Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Other'],
        table: 'nominees',
    },
    {
        label: 'Nominee 3 Share (%)',
        key: 'nominee3Share',
        x: 150,
        y: 600,
        page: 10,
        required: false,
        type: 'number',
        table: 'nominees',
    },
    {
        label: 'Nominee 3 Govt ID',
        key: 'nominee3GovtId',
        x: 400,
        y: 600,
        page: 10,
        required: false,
        type: 'text',
        table: 'nominees',
    },

    // Page 12 - GST Registration (if applicable)
    {
        label: 'GST Registration Number',
        key: 'gstRegisterNo',
        x: 150,
        y: 750,
        page: 11,
        required: false,
        type: 'text',
        table: 'gst_registration',
    },
    {
        label: 'GST State Name',
        key: 'gstStateName',
        x: 400,
        y: 750,
        page: 11,
        required: false,
        type: 'text',
        table: 'gst_registration',
    },
    {
        label: 'GST Validity Date',
        key: 'gstValidityDate',
        x: 150,
        y: 720,
        page: 11,
        required: false,
        type: 'date',
        table: 'gst_registration',
    },

    // Page 13 - User Preferences
    {
        label: 'Chart Provider',
        key: 'chartProvider',
        x: 150,
        y: 750,
        page: 12,
        required: true,
        type: 'select',
        options: ['TradingView', 'ChartIQ'],
        table: 'user_preferences',
    },
    {
        label: 'Biometric Permission',
        key: 'biometricPermission',
        x: 400,
        y: 750,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Internet Permission',
        key: 'internetPermission',
        x: 150,
        y: 720,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Notification Permission',
        key: 'notificationPermission',
        x: 400,
        y: 720,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Order Notifications',
        key: 'orderNotifications',
        x: 150,
        y: 690,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Trade Notifications',
        key: 'tradeNotifications',
        x: 400,
        y: 690,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Promotion Notifications',
        key: 'promotionNotifications',
        x: 150,
        y: 660,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },
    {
        label: 'Trade Recommendations',
        key: 'tradeRecommendations',
        x: 400,
        y: 660,
        page: 12,
        required: true,
        type: 'checkbox',
        table: 'user_preferences',
    },

    // Page 14 - Document Uploads & E-sign
    {
        label: 'Signature Document',
        key: 'signature',
        x: 150,
        y: 750,
        page: 13,
        required: true,
        type: 'file',
        table: 'user',
    },
    { label: 'E-sign', key: 'esign', x: 400, y: 750, page: 13, required: true, type: 'file', table: 'user' },
    {
        label: 'IPV (In Person Verification)',
        key: 'ipv',
        x: 150,
        y: 720,
        page: 13,
        required: true,
        type: 'file',
        table: 'user',
    },
    {
        label: 'Profile Picture',
        key: 'profilePicture',
        x: 400,
        y: 720,
        page: 13,
        required: false,
        type: 'file',
        table: 'profile_pictures',
    },
];

// ===== PAGE SECTIONS CONFIGURATION =====

export const defaultPageSections: Record<number, PageSection[]> = {
    0: [
        { title: 'BASIC INFORMATION', fields: ['formNo', 'clientId', 'date'] },
        {
            title: 'NAME DETAILS',
            fields: [
                'firstName',
                'middleName',
                'lastName',
                'fatherSpouseFirstName',
                'fatherSpouseMiddleName',
                'fatherSpouseLastName',
                'motherFirstName',
                'motherMiddleName',
                'motherLastName',
                'maidenFirstName',
                'maidenMiddleName',
                'maidenLastName',
            ],
        },
        { title: 'PERSONAL DETAILS', fields: ['dob', 'userProvidedDob', 'gender', 'maritalStatus'] },
        {
            title: 'NATIONALITY & CITIZENSHIP',
            fields: [
                'nationality',
                'otherNationality',
                'countryOfCitizenship',
                'countryOfResidence',
                'residentialStatus',
            ],
        },
        { title: 'CONTACT INFORMATION', fields: ['email', 'phone', 'officeTelNum', 'residenceTelNum'] },
        {
            title: 'ADDRESS INFORMATION',
            fields: [
                'permanentLine1',
                'permanentLine2',
                'permanentLine3',
                'permanentCity',
                'permanentState',
                'permanentPinCode',
                'permanentCountry',
                'permanentAddressType',
            ],
        },
    ],
    1: [
        {
            title: 'CORRESPONDENCE ADDRESS',
            fields: [
                'sameAsPermanent',
                'correspondenceLine1',
                'correspondenceLine2',
                'correspondenceLine3',
                'correspondenceCity',
                'correspondenceState',
                'correspondencePinCode',
                'correspondenceCountry',
                'correspondenceAddressType',
            ],
        },
    ],
    2: [
        {
            title: 'PAN INFORMATION',
            fields: ['panNumber', 'panDocument', 'panDocumentIssuer', 'panCategory', 'panStatus', 'aadhaarLinked'],
        },
        { title: 'AADHAAR INFORMATION', fields: ['maskedAadhaar', 'maskedAadhaarNo', 'co', 'postOffice'] },
    ],
    3: [
        {
            title: 'BANK ACCOUNT DETAILS',
            fields: ['accountNo', 'ifscCode', 'accountType', 'isPrimaryBank', 'bankVerification'],
        },
    ],
    4: [{ title: 'DEMAT ACCOUNT INFORMATION', fields: ['boId', 'dpId', 'depository', 'dpName', 'clientName'] }],
    5: [
        {
            title: 'INCOME & OCCUPATION',
            fields: ['annualIncome', 'occupation', 'tradingExp', 'incomeProofType', 'incomeProof'],
        },
    ],
    6: [
        { title: 'INVESTMENT SEGMENTS', fields: ['investmentSegments'] },
        {
            title: 'SETTLEMENT PREFERENCES',
            fields: ['accountSettlement', 'dpAccountSettlement', 'fundsSettlementFrequency'],
        },
    ],
    7: [
        {
            title: 'TRADING FACILITIES',
            fields: ['internetTradingFacility', 'marginTradingFacility', 'disFacility', 'bsdaFacility'],
        },
        { title: 'REPORT PREFERENCES', fields: ['annualReportType', 'contractNoteType', 'emailWithRegistrar'] },
    ],
    8: [
        {
            title: 'ACCOUNT TYPE & COMPLIANCE',
            fields: [
                'userAccountType',
                'businessCategorization',
                'clientCategoryCommercialNonCommercial',
                'isPoliticallyExposed',
                'isUsPerson',
                'pastActions',
            ],
        },
    ],
    9: [{ title: 'COMMUNICATION DECLARATIONS', fields: ['emailDeclaration', 'mobileDeclaration'] }],
    10: [
        {
            title: 'NOMINEE DETAILS',
            fields: [
                'nominee1Name',
                'nominee1Relationship',
                'nominee1Share',
                'nominee1GovtId',
                'nominee2Name',
                'nominee2Relationship',
                'nominee2Share',
                'nominee2GovtId',
                'nominee3Name',
                'nominee3Relationship',
                'nominee3Share',
                'nominee3GovtId',
            ],
        },
    ],
    11: [{ title: 'GST REGISTRATION (Optional)', fields: ['gstRegisterNo', 'gstStateName', 'gstValidityDate'] }],
    12: [
        { title: 'APPLICATION PREFERENCES', fields: ['chartProvider'] },
        {
            title: 'NOTIFICATION SETTINGS',
            fields: [
                'biometricPermission',
                'internetPermission',
                'notificationPermission',
                'orderNotifications',
                'tradeNotifications',
                'promotionNotifications',
                'tradeRecommendations',
            ],
        },
    ],
    13: [{ title: 'DOCUMENT UPLOADS', fields: ['signature', 'esign', 'ipv', 'profilePicture'] }],
};

// ===== UTILITY FUNCTIONS =====

/**
 * Get fields by page number
 */
export const getFieldsByPage = (page: number): FormField[] => {
    return customFormFields.filter((field) => field.page === page);
};

/**
 * Get required fields
 */
export const getRequiredFields = (): FormField[] => {
    return customFormFields.filter((field) => field.required);
};

/**
 * Get fields by table name
 */
export const getFieldsByTable = (tableName: string): FormField[] => {
    return customFormFields.filter((field) => field.table === tableName);
};

/**
 * Get fields by type
 */
export const getFieldsByType = (type: FormFieldType): FormField[] => {
    return customFormFields.filter((field) => field.type === type);
};

/**
 * Get conditional fields
 */
export const getConditionalFields = (): FormField[] => {
    return customFormFields.filter((field) => field.conditional);
};

/**
 * Validate field value against its type
 */
export const validateFieldValue = (field: FormField, value: any): boolean => {
    if (field.required && (value === null || value === undefined || value === '')) {
        return false;
    }

    if (!field.required && (value === null || value === undefined || value === '')) {
        return true;
    }

    switch (field.type) {
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value);

        case 'tel':
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));

        case 'number':
            return !isNaN(Number(value)) && Number(value) >= 0;

        case 'date':
            return !isNaN(Date.parse(value));

        case 'select':
            return field.options ? field.options.includes(value) : true;

        case 'multi-select':
            return Array.isArray(value) && field.options ? value.every((v) => field.options!.includes(v)) : true;

        case 'checkbox':
            return typeof value === 'boolean';

        default:
            return true;
    }
};

/**
 * Get field validation error message
 */
export const getFieldValidationError = (field: FormField, value: any): string | null => {
    if (field.required && (value === null || value === undefined || value === '')) {
        return `${field.label} is required`;
    }

    if (!validateFieldValue(field, value)) {
        switch (field.type) {
            case 'email':
                return `${field.label} must be a valid email address`;
            case 'tel':
                return `${field.label} must be a valid phone number`;
            case 'number':
                return `${field.label} must be a valid number`;
            case 'date':
                return `${field.label} must be a valid date`;
            case 'select':
                return `${field.label} must be one of: ${field.options?.join(', ')}`;
            case 'multi-select':
                return `${field.label} must contain only valid options: ${field.options?.join(', ')}`;
            default:
                return `${field.label} is invalid`;
        }
    }

    return null;
};
