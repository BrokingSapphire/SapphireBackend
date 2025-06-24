// src/services/pdf-generator.ts

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '@app/logger';
import { customFormFields, defaultPageSections } from './notifications-types/pdf.types';
import AOFService from './aof.service';

export interface PDFGenerationResult {
    success: boolean;
    aofNumber?: string;
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
    type: string;
    table?: string;
    conditional?: string;
    options?: string[];
}

export interface PDFColors {
    primary: { r: number; g: number; b: number };
    secondary: { r: number; g: number; b: number };
    text: { r: number; g: number; b: number };
    accent: { r: number; g: number; b: number };
    border: { r: number; g: number; b: number };
}

/**
 * Service for generating comprehensive PDF forms
 */
class PDFGenerationService {
    private readonly defaultColors: PDFColors = {
        primary: { r: 0.2, g: 0.4, b: 0.8 }, // Blue
        secondary: { r: 0.9, g: 0.9, b: 0.9 }, // Light gray
        text: { r: 0, g: 0, b: 0 }, // Black
        accent: { r: 0.8, g: 0.2, b: 0.2 }, // Red
        border: { r: 0.6, g: 0.6, b: 0.6 }, // Gray border
    };

    private readonly pageHeaders = [
        'PERSONAL INFORMATION',
        'CORRESPONDENCE & ADDRESS',
        'PAN & AADHAAR DETAILS',
        'BANKING INFORMATION',
        'DEMAT ACCOUNT DETAILS',
        'FINANCIAL INFORMATION',
        'INVESTMENT PREFERENCES',
        'TRADING FACILITIES',
        'COMPLIANCE & BUSINESS',
        'DECLARATIONS',
        'NOMINEE INFORMATION',
        'GST REGISTRATION',
        'USER PREFERENCES',
        'DOCUMENTS & E-SIGN',
    ];

    /**
     * Generate PDF from user data and form fields
     */
    public async generatePDF(
        userData: Record<string, any>,
        formFields: FormField[],
        clientId?: string,
        pageSections?: Record<number, { title: string; fields: string[] }[]>,
    ): Promise<PDFGenerationResult> {
        try {
            const currentFilename = process.argv[1];
            const currentDirname = path.dirname(currentFilename);
            const aofService = new AOFService();
            const aofNumber = await aofService.generateNextAOFNumber();

            // Generate filename based on clientId or fallback to default
            const outputFileName = clientId
                ? `${aofNumber}_${clientId}_${new Date().toISOString().split('T')[0]}.pdf`
                : `${aofNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

            // Create client-specific directory if clientId is provided
            let outputDir = __dirname;
            if (clientId) {
                outputDir = path.join(__dirname, 'client-documents', clientId);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
            }

            logger.info('Starting PDF generation', {
                clientId,
                outputFileName,
                outputDir,
                totalFields: formFields.length,
                userDataKeys: Object.keys(userData).length,
            });

            // Create new PDF document
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // Determine number of pages from form fields
            const maxPage = Math.max(...formFields.map((field) => field.page));
            const totalPages = maxPage + 1;

            // Create all pages
            const pages: any[] = [];
            for (let i = 0; i < totalPages; i++) {
                pages.push(pdfDoc.addPage([595, 842])); // A4 size
            }

            // Convert colors to pdf-lib format
            const colors = {
                primary: rgb(this.defaultColors.primary.r, this.defaultColors.primary.g, this.defaultColors.primary.b),
                secondary: rgb(
                    this.defaultColors.secondary.r,
                    this.defaultColors.secondary.g,
                    this.defaultColors.secondary.b,
                ),
                text: rgb(this.defaultColors.text.r, this.defaultColors.text.g, this.defaultColors.text.b),
                accent: rgb(this.defaultColors.accent.r, this.defaultColors.accent.g, this.defaultColors.accent.b),
                border: rgb(this.defaultColors.border.r, this.defaultColors.border.g, this.defaultColors.border.b),
            };

            // Organize fields by page
            const fieldsByPage = this.organizeFieldsByPage(formFields);

            // Process each page
            Object.keys(fieldsByPage).forEach((pageIndex) => {
                const page = pages[parseInt(pageIndex, 10)];
                const pageFields = fieldsByPage[pageIndex];
                const sections = pageSections?.[parseInt(pageIndex, 10)] || [];

                this.renderPage(page, pageFields, sections, userData, font, boldFont, colors);
            });

            // Add headers and footers to all pages
            pages.forEach((page, index) => {
                this.drawHeader(
                    page,
                    this.pageHeaders[index] || `PAGE ${index + 1}`,
                    `${index + 1} of ${totalPages}`,
                    boldFont,
                    font,
                    colors,
                );
                this.drawFooter(page, outputFileName, index + 1, font, colors);
            });

            // Save PDF
            const pdfBytes = await pdfDoc.save();
            const outputPath = path.join(outputDir, outputFileName);

            fs.writeFileSync(outputPath, pdfBytes);

            // Count filled fields
            const userDataKeys = Object.keys(userData).filter(
                (key) => userData[key] !== null && userData[key] !== undefined && userData[key] !== '',
            );

            logger.info('PDF generated successfully', {
                clientId,
                aofNumber,
                fileName: outputFileName,
                fieldsTotal: formFields.length,
                fieldsFilled: userDataKeys.length,
                pages: totalPages,
            });

            return {
                success: true,
                aofNumber,
                filePath: outputPath,
                fileName: outputFileName,
                fieldsTotal: formFields.length,
                fieldsFilled: userDataKeys.length,
                pages: totalPages,
            };
        } catch (error: any) {
            logger.error('Error generating PDF:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Organize form fields by page number
     */
    private organizeFieldsByPage(formFields: FormField[]): Record<string, FormField[]> {
        const fieldsByPage: Record<string, FormField[]> = {};

        formFields.forEach((field) => {
            if (!fieldsByPage[field.page]) {
                fieldsByPage[field.page] = [];
            }
            fieldsByPage[field.page].push(field);
        });

        return fieldsByPage;
    }

    /**
     * Render a single page with its fields and sections
     */
    private renderPage(
        page: any,
        pageFields: FormField[],
        sections: { title: string; fields: string[] }[],
        userData: Record<string, any>,
        font: any,
        boldFont: any,
        colors: any,
    ): void {
        let currentY = 650; // Start below header

        if (sections.length > 0) {
            sections.forEach((section) => {
                // Draw section header
                this.drawSectionHeader(page, section.title, 60, currentY + 20, boldFont, colors);
                currentY -= 50; // Space after section header

                // Get fields for this section
                const sectionFields = pageFields.filter((field) => section.fields.includes(field.key));

                currentY = this.renderSectionFields(page, sectionFields, userData, currentY, font, boldFont, colors);
                currentY -= 30; // Extra space between sections
            });
        } else {
            // Render all fields without sections
            this.renderSectionFields(page, pageFields, userData, currentY, font, boldFont, colors);
        }
    }

    /**
     * Render fields for a section
     */
    private renderSectionFields(
        page: any,
        sectionFields: FormField[],
        userData: Record<string, any>,
        startY: number,
        font: any,
        boldFont: any,
        colors: any,
    ): number {
        let currentY = startY;
        const currentX = 60;
        let fieldsInRow = 0;
        const maxFieldsPerRow = 3;
        const horizontalSpacing = 170;
        const verticalSpacing = 40;

        sectionFields.forEach((field) => {
            const value = userData[field.key] || '';

            // Skip conditional fields if condition not met
            if (this.shouldSkipField(field, userData)) {
                return;
            }

            // Calculate position
            const x = currentX + fieldsInRow * horizontalSpacing;
            const y = currentY;

            // Adjust width based on field type
            let width = 150;
            if (field.type === 'file') width = 120;
            else if (field.key.includes('Line') || field.key.includes('Address')) width = 200;
            else if (field.type === 'multi-select') width = 200;

            // Draw field based on type
            if (field.type === 'checkbox') {
                this.drawCheckboxField(page, field.label, value, x, y, font, boldFont, colors);
            } else if (field.type === 'multi-select' && Array.isArray(value)) {
                this.drawFormField(page, field.label, value.join(', '), x, y, width, 20, font, boldFont, colors);
            } else {
                this.drawFormField(page, field.label, value, x, y, width, 20, font, boldFont, colors);
            }

            // Update position for next field
            fieldsInRow++;
            if (fieldsInRow >= maxFieldsPerRow) {
                fieldsInRow = 0;
                currentY -= verticalSpacing;
            }
        });

        // Complete the row if needed
        if (fieldsInRow > 0) {
            currentY -= verticalSpacing;
        }

        return currentY;
    }

    /**
     * Check if field should be skipped based on conditions
     */
    private shouldSkipField(field: FormField, userData: Record<string, any>): boolean {
        if (!field.conditional) return false;

        switch (field.conditional) {
            case 'married_female':
                return !(userData.gender === 'Female' && userData.maritalStatus === 'Married');
            case 'other_nationality':
                return userData.nationality !== 'OTHER';
            case 'different_address':
                return userData.sameAsPermanent === true;
            default:
                return false;
        }
    }

    /**
     * Draw form header
     */
    private drawHeader(page: any, title: string, pageNum: string, boldFont: any, font: any, colors: any): void {
        // Header background
        page.drawRectangle({
            x: 50,
            y: 780,
            width: 495,
            height: 50,
            color: colors.primary,
        });

        // Title
        page.drawText(title, {
            x: 60,
            y: 800,
            size: 18,
            font: boldFont,
            color: rgb(1, 1, 1), // White text
        });

        // Page number
        page.drawText(`Page ${pageNum}`, {
            x: 500,
            y: 800,
            size: 12,
            font,
            color: rgb(1, 1, 1),
        });

        // Company/Form info
        page.drawText('CLIENT ONBOARDING FORM', {
            x: 60,
            y: 785,
            size: 10,
            font,
            color: rgb(1, 1, 1),
        });
    }

    /**
     * Draw section header
     */
    private drawSectionHeader(
        page: any,
        title: string,
        x: number,
        y: number,
        boldFont: any,
        colors: any,
        width = 400,
    ): void {
        // Section background
        page.drawRectangle({
            x: x - 5,
            y: y - 5,
            width,
            height: 25,
            color: colors.secondary,
            borderColor: colors.border,
            borderWidth: 1,
        });

        // Section title
        page.drawText(title, {
            x,
            y: y + 5,
            size: 12,
            font: boldFont,
            color: colors.primary,
        });
    }

    /**
     * Draw form field with label and input box
     */
    private drawFormField(
        page: any,
        label: string,
        value: any,
        x: number,
        y: number,
        width = 180,
        height = 20,
        font: any,
        boldFont: any,
        colors: any,
    ): void {
        // Label (positioned above the input box)
        page.drawText(label + ':', {
            x,
            y: y + height + 8,
            size: 8,
            font: boldFont,
            color: colors.text,
        });

        // Input box border
        page.drawRectangle({
            x,
            y,
            width,
            height,
            borderColor: colors.border,
            borderWidth: 1,
        });

        // Fill value if provided
        if (value) {
            // Truncate long text to fit the box
            let displayValue = String(value);
            if (displayValue.length > Math.floor(width / 7)) {
                displayValue = displayValue.substring(0, Math.floor(width / 7) - 3) + '...';
            }

            page.drawText(displayValue, {
                x: x + 3,
                y: y + 6,
                size: 9,
                font,
                color: colors.text,
            });
        }
    }

    /**
     * Draw checkbox field
     */
    private drawCheckboxField(
        page: any,
        label: string,
        value: any,
        x: number,
        y: number,
        font: any,
        boldFont: any,
        colors: any,
    ): void {
        // Checkbox box
        page.drawRectangle({
            x,
            y: y + 5,
            width: 12,
            height: 12,
            borderColor: colors.border,
            borderWidth: 1,
        });

        // Check mark if true - using 'X' instead of special character
        if (value === true || value === 'YES' || value === 'yes') {
            page.drawText('X', {
                x: x + 3,
                y: y + 6,
                size: 9,
                font: boldFont,
                color: colors.text,
            });
        }

        // Label
        page.drawText(label, {
            x: x + 20,
            y: y + 6,
            size: 9,
            font,
            color: colors.text,
        });
    }

    /**
     * Draw page footer
     */
    private drawFooter(page: any, fileName: string, pageNum: number, font: any, colors: any): void {
        // Footer line
        page.drawLine({
            start: { x: 50, y: 50 },
            end: { x: 545, y: 50 },
            thickness: 1,
            color: colors.border,
        });

        // Footer text
        page.drawText(`${fileName} | Page ${pageNum} | Generated: ${new Date().toLocaleDateString()}`, {
            x: 50,
            y: 35,
            size: 8,
            font,
            color: colors.border,
        });
    }

    /**
     * Validate required fields in user data
     */
    public validateRequiredFields(userData: Record<string, any>, formFields: FormField[]): string[] {
        const missingFields: string[] = [];

        formFields.forEach((field) => {
            if (field.required) {
                const value = userData[field.key];
                if (value === null || value === undefined || value === '') {
                    missingFields.push(field.label);
                }
            }
        });

        return missingFields;
    }

    /**
     * Get form field statistics
     */
    public getFormStatistics(
        userData: Record<string, any>,
        formFields: FormField[],
    ): {
        totalFields: number;
        requiredFields: number;
        filledFields: number;
        filledRequiredFields: number;
        completionPercentage: number;
    } {
        const totalFields = formFields.length;
        const requiredFields = formFields.filter((field) => field.required).length;

        const filledFields = formFields.filter((field) => {
            const value = userData[field.key];
            return value !== null && value !== undefined && value !== '';
        }).length;

        const filledRequiredFields = formFields.filter((field) => {
            if (!field.required) return false;
            const value = userData[field.key];
            return value !== null && value !== undefined && value !== '';
        }).length;

        const completionPercentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

        return {
            totalFields,
            requiredFields,
            filledFields,
            filledRequiredFields,
            completionPercentage,
        };
    }
}

// ************************************************************** SAMPLE TEST DATA **************************************************************

const testUserData = {
    // Basic Information
    formNo: 'CLI001',
    clientId: 'TEST_CLIENT_001',
    date: new Date().toLocaleDateString('en-GB'),

    // Name Information
    firstName: 'RAJESH',
    middleName: 'KUMAR',
    lastName: 'SHARMA',
    fatherSpouseFirstName: 'RAMESH',
    fatherSpouseMiddleName: 'CHANDRA',
    fatherSpouseLastName: 'SHARMA',
    motherFirstName: 'SUNITA',
    motherMiddleName: '',
    motherLastName: 'SHARMA',

    // Personal Details
    dob: '15/03/1985',
    userProvidedDob: '15/03/1985',
    gender: 'Male',
    maritalStatus: 'Married',
    nationality: 'INDIAN',
    countryOfCitizenship: 'INDIA',
    countryOfResidence: 'INDIA',
    residentialStatus: 'Resident Individual',

    // Contact Information
    email: 'rajesh.sharma@test.com',
    phone: '9876543210',
    officeTelNum: '011-12345678',
    residenceTelNum: '011-87654321',

    // Permanent Address
    permanentLine1: 'House No. 123, Gandhi Nagar',
    permanentLine2: 'Near City Hospital',
    permanentLine3: 'Sector 4',
    permanentCity: 'Muzaffarnagar',
    permanentState: 'Uttar Pradesh',
    permanentPinCode: '251001',
    permanentCountry: 'INDIA',
    permanentAddressType: 'Residential',

    // Correspondence Address
    sameAsPermanent: true,

    // PAN & Aadhaar
    panNumber: 'ABCDE1234F',
    panDocument: 'pan_document.pdf',
    panDocumentIssuer: 'Income Tax Department',
    panCategory: 'Individual',
    panStatus: 'Valid',
    aadhaarLinked: 'YES',
    maskedAadhaar: 'XXXXXXXX5678',
    maskedAadhaarNo: 'XXXXXXXX5678',
    co: 'S/O Ramesh Chandra Sharma',
    postOffice: 'Muzaffarnagar',

    // Banking
    accountNo: '123456789012',
    ifscCode: 'SBIN0001234',
    accountType: 'savings',
    isPrimaryBank: true,
    bankVerification: 'verified',

    // Demat
    boId: '1234567890123456',
    dpId: 'IN300214',
    depository: 'CDSL',
    dpName: 'CDSL-DP Services',
    clientName: 'RAJESH KUMAR SHARMA',

    // Financial Information
    annualIncome: '5_10_Lakh',
    occupation: 'private sector',
    tradingExp: '1-5',
    incomeProofType: 'salary_slip_15k_monthly',
    incomeProof: 'salary_slip.pdf',

    // Investment Preferences
    investmentSegments: ['Cash', 'F&O'],
    accountSettlement: 'Monthly',
    dpAccountSettlement: 'Monthly',
    fundsSettlementFrequency: '30_days',

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
    isPoliticallyExposed: 'NO',
    isUsPerson: 'NO',
    pastActions: 'NO',

    // Declarations
    emailDeclaration: 'Self',
    mobileDeclaration: 'Self',

    // Nominees
    nominee1Name: 'PRIYA SHARMA',
    nominee1Relationship: 'Spouse',
    nominee1Share: 60,
    nominee1GovtId: 'AADHAAR-XXXX5432',
    nominee2Name: 'ARJUN SHARMA',
    nominee2Relationship: 'Son',
    nominee2Share: 40,
    nominee2GovtId: 'AADHAAR-XXXX9876',

    // User Preferences
    chartProvider: 'TradingView',
    biometricPermission: true,
    internetPermission: true,
    notificationPermission: true,
    orderNotifications: true,
    tradeNotifications: true,
    promotionNotifications: false,
    tradeRecommendations: true,

    // Documents
    signature: 'signature_doc.png',
    esign: 'esign_doc.xml',
    ipv: 'ipv_video.mp4',
    profilePicture: 'profile_pic.jpg',
};
/**
 * Test function to generate PDF with hardcoded data
 */
export async function testPDFGeneration(): Promise<PDFGenerationResult> {
    console.log(' Starting PDF generation test...');
    console.log('Test data prepared with client:', testUserData.clientId);

    try {
        const pdfService = new PDFGenerationService();
        const result = await pdfService.generatePDF(
            testUserData,
            customFormFields,
            testUserData.clientId,
            defaultPageSections,
        );

        if (result.success) {
            console.log('PDF generated successfully!');
            console.log(`File: ${result.fileName}`);
            console.log(`Path: ${result.filePath}`);
            console.log(`Pages: ${result.pages}`);
            console.log(`Total fields: ${result.fieldsTotal}`);
            console.log(`Fields filled: ${result.fieldsFilled}`);
            if (result.fieldsTotal && result.fieldsFilled) {
                console.log(`Completion: ${Math.round((result.fieldsFilled / result.fieldsTotal) * 100)}%`);
            }
        } else {
            console.error('PDF generation failed:', result.error);
        }

        return result;
    } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
    }
}

/**
 * Test function with real database data
 */
export async function testPDFGenerationFromDB(email: string): Promise<PDFGenerationResult> {
    console.log('Starting PDF generation test with database data...');
    console.log(`Fetching data for email: ${email}`);

    try {
        const PDFDataFetcherService = await import('./pdf-data-fetcher.service');

        // Fetch real data from database
        const userData = await PDFDataFetcherService.default.fetchSignupDataForPDF(email);
        console.log(`Successfully fetched data for client: ${userData.clientId}`);

        // Generate PDF with real data
        const pdfService = new PDFGenerationService();
        const result = await pdfService.generatePDF(userData, customFormFields, userData.clientId, defaultPageSections);

        if (result.success) {
            console.log('PDF generated successfully with database data!');
            console.log(`File: ${result.fileName}`);
            console.log(`Path: ${result.filePath}`);
            console.log(`Pages: ${result.pages}`);
            console.log(`Total fields: ${result.fieldsTotal}`);
            console.log(`Fields filled: ${result.fieldsFilled}`);
            if (result.fieldsTotal && result.fieldsFilled) {
                console.log(`Completion: ${Math.round((result.fieldsFilled / result.fieldsTotal) * 100)}%`);
            }
        } else {
            console.error('PDF generation failed:', result.error);
        }

        return result;
    } catch (error) {
        console.error('Database test failed:', error);
        throw error;
    }
}

export default new PDFGenerationService();
