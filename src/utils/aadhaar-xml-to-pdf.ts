import * as fs from 'fs';
import * as pdf from 'html-pdf';
import AadhaarXMLParser from './aadhaar-xml.parser';

export interface AadhaarData {
    name?: string;
    dob?: string;
    gender?: string;
    address?: string;
    aadhaarNumber?: string;
    photo?: string;
    validTill?: string;
    doi?: string;
}

/**
 * AadhaarConverter class for converting Aadhaar XML data to HTML/PDF
 * Provides methods to work with XML data as strings and return buffers
 */
export class AadhaarConverter {
    private templatePath: string;

    constructor(templatePath?: string) {
        this.templatePath = templatePath || 'documents/aadhaar.html';
    }

    /**
     * Converts Aadhaar XML string to PDF buffer
     * @param xmlData XML content as string
     * @returns Buffer containing PDF content
     */
    public async convertXmlToPdfBuffer(xmlData: string): Promise<Buffer> {
        try {
            const aadhaarData = this.parseXmlData(xmlData);
            const htmlContent = this.generateHtml(aadhaarData);
            return await this.generatePdf(htmlContent);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to convert XML to PDF buffer: ${message}`);
        }
    }

    /**
     * Converts Aadhaar XML string to HTML buffer
     * @param xmlData XML content as string
     * @returns Buffer containing HTML content
     */
    public convertXmlToHtmlBuffer(xmlData: string): Buffer {
        try {
            const aadhaarData = this.parseXmlData(xmlData);
            const htmlContent = this.generateHtml(aadhaarData);
            return Buffer.from(htmlContent, 'utf-8');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to convert XML to HTML buffer: ${message}`);
        }
    }

    /**
     * Converts Aadhaar XML string to HTML string
     * @param xmlData XML content as string
     * @returns HTML content as string
     */
    public convertXmlToHtml(xmlData: string): string {
        try {
            const aadhaarData = this.parseXmlData(xmlData);
            return this.generateHtml(aadhaarData);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to convert XML to HTML: ${message}`);
        }
    }

    /**
     * Extracts Aadhaar data from XML string
     * @param xmlData XML content as string
     * @returns Parsed Aadhaar data object
     */
    public extractAadhaarData(xmlData: string): AadhaarData {
        return this.parseXmlData(xmlData);
    }

    /**
     * Private method to parse XML data
     */
    private parseXmlData(xmlData: string): AadhaarData {
        const parser = new AadhaarXMLParser(xmlData);
        parser.load();

        const address = parser.address();
        const addressString = [
            address.line_1,
            address.line_2,
            address.line_3,
            address.city,
            address.state,
            address.country,
            address.postalCode,
        ]
            .filter(Boolean)
            .join(', ');

        // Extract photo from XML manually
        const photoMatch = xmlData.match(/<Pht>([^<]+)<\/Pht>/);
        const photoBase64 = photoMatch ? photoMatch[1] : undefined;

        // Extract validity dates from XML
        const ttlMatch = xmlData.match(/ttl="([^"]+)"/);
        const validTill = ttlMatch ? ttlMatch[1].split('T')[0] : undefined;

        const tsMatch = xmlData.match(/ts="([^"]+)"/);
        const doi = tsMatch ? tsMatch[1].split('T')[0] : undefined;

        return {
            name: parser.name(),
            dob: parser.dob()?.toISOString().split('T')[0],
            gender: parser.gender(),
            address: addressString,
            aadhaarNumber: parser.uid(),
            photo: photoBase64,
            validTill,
            doi,
        };
    }

    /**
     * Private method to generate HTML from data
     */
    private generateHtml(data: AadhaarData): string {
        if (!fs.existsSync(this.templatePath)) {
            throw new Error(`Template file not found: ${this.templatePath}`);
        }

        let htmlTemplate = fs.readFileSync(this.templatePath, 'utf-8');

        // Replace placeholders with actual data
        const replacements = {
            '{{NAME}}': data.name || 'N/A',
            '{{DOB}}': this.formatDate(data.dob) || 'N/A',
            '{{GENDER}}': data.gender || 'N/A',
            '{{ADDRESS}}': this.formatAddress(data.address) || 'N/A',
            '{{AADHAAR_NUMBER}}': this.formatAadhaarNumber(data.aadhaarNumber) || 'xxxx xxxx xxxx',
            '{{PHOTO}}': this.generatePhotoHtml(data.photo),
            '{{VALID_TILL}}': `Valid: Till ${this.formatDate(data.validTill) || 'N/A'}`,
            '{{DOI}}': `DOI: ${this.formatDate(data.doi) || 'N/A'}`,
        };

        // Replace all placeholders
        Object.entries(replacements).forEach(([placeholder, value]) => {
            htmlTemplate = htmlTemplate.replace(new RegExp(placeholder, 'g'), value);
        });

        return htmlTemplate;
    }

    /**
     * Private method to format dates
     */
    private formatDate(dateString?: string): string {
        if (!dateString) return '';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // Return original if invalid

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    }

    /**
     * Private method to format address
     */
    private formatAddress(address?: string): string {
        if (!address) return '';

        // Replace common separators with line breaks
        return address.replace(/,\s*/g, '<br>').replace(/\n/g, '<br>').trim();
    }

    /**
     * Private method to format Aadhaar number
     */
    private formatAadhaarNumber(aadhaarNumber?: string): string {
        if (!aadhaarNumber) return 'xxxx xxxx xxxx';

        // Remove all non-digit characters
        const digits = aadhaarNumber.replace(/\D/g, '');

        if (digits.length >= 4) {
            const lastFour = digits.slice(-4);
            return `xxxx xxxx ${lastFour}`;
        }

        return 'xxxx xxxx xxxx';
    }

    /**
     * Private method to generate photo HTML
     */
    private generatePhotoHtml(photoBase64?: string): string {
        if (!photoBase64) {
            return '<div class="photo-placeholder">No Photo</div>';
        }

        // If it's already a data URL, use it directly
        if (photoBase64.startsWith('data:image/')) {
            return `<img src="${photoBase64}" alt="Aadhaar Photo" class="photo">`;
        }

        // Otherwise, assume it's base64 and create data URL
        return `<img src="data:image/jpeg;base64,${photoBase64}" alt="Aadhaar Photo" class="photo">`;
    }

    /**
     * Private method to generate PDF from HTML
     */
    private generatePdf(htmlContent: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const options: pdf.CreateOptions = {
                format: 'A4',
                orientation: 'portrait',
                border: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in',
                },
                type: 'pdf',
                quality: '75',
                phantomPath: undefined, // Use system phantom or bundled
                timeout: 30000,
                height: '11.7in',
                width: '8.3in',
                header: {
                    height: '0mm',
                },
                footer: {
                    height: '0mm',
                },
            };

            pdf.create(htmlContent, options).toBuffer((err, buffer) => {
                if (err) {
                    reject(new Error(`PDF generation failed: ${err.message}`));
                    return;
                }
                if (!buffer) {
                    reject(new Error('PDF generation failed: No buffer returned'));
                    return;
                }
                resolve(buffer);
            });
        });
    }
}
