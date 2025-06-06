// src/services/pdfService.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { PDFField, PDFOptions } from '@app/modules/pdfFiller/pdfFiller.types';
import fetch from 'node-fetch';
import { S3Utils } from '@app/services/multer-s3.service';

// Use process.cwd() for cross-platform compatibility
const __dirname = process.cwd();

export class PDFService {
    private templatesDir: string;
    private outputDir: string;
    private readonly supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    private readonly maxImageSize = 10 * 1024 * 1024; // 10MB

    constructor() {
        this.templatesDir = path.join(__dirname, 'templates');
        this.outputDir = path.join(__dirname, 'output');

        this.initializeDirectories();
    }

    private initializeDirectories(): void {
        try {
            if (!fs.existsSync(this.templatesDir)) {
                fs.mkdirSync(this.templatesDir, { recursive: true });
                console.log(`Created templates directory: ${this.templatesDir}`);
            }
            // Keep local output directory for temporary files
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log(`Created output directory: ${this.outputDir}`);
            }
        } catch (error: any) {
            throw new Error(`Failed to initialize directories: ${error.message}`);
        }
    }

    async fillPDF(
        templateName: string,
        outputName: string,
        fields: PDFField[],
        options?: PDFOptions,
    ): Promise<{
        s3Key: string;
        s3Url: string;
        localPath: string;
        fileSize: number;
    }> {
        let tempFilePath: string | null = null;

        try {
            console.log(`Starting PDF fill process for template: ${templateName}`);

            const inputPath = path.join(this.templatesDir, templateName);

            // Validate template exists
            if (!fs.existsSync(inputPath)) {
                throw new Error(
                    `Template not found: ${templateName}. Please ensure the template exists in the templates directory.`,
                );
            }

            // Load PDF document
            const pdfBytes = await this.loadPDFDocument(inputPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            const pageCount = pages.length;

            console.log(`PDF loaded successfully. Page count: ${pageCount}`);

            // Set up font and styling options
            const fontSize = options?.fontSize || 12;
            const fontColor = options?.fontColor
                ? rgb(options.fontColor.r, options.fontColor.g, options.fontColor.b)
                : rgb(0, 0, 0);
            const fontName = options?.fontName || StandardFonts.Helvetica;

            const font = await pdfDoc.embedFont(fontName);

            // Process each field
            let processedFields = 0;
            let skippedFields = 0;

            for (const [index, field] of fields.entries()) {
                try {
                    const success = await this.processField(
                        field,
                        pages,
                        pageCount,
                        font,
                        fontSize,
                        fontColor,
                        pdfDoc,
                        index,
                    );
                    if (success) {
                        processedFields++;
                    } else {
                        skippedFields++;
                    }
                } catch (fieldError: any) {
                    console.error(`Error processing field ${index}:`, fieldError.message);
                    skippedFields++;
                }
            }

            console.log(`Fields processed: ${processedFields}, Fields skipped: ${skippedFields}`);

            // Save to temporary local file first
            const tempFileName = `temp_${Date.now()}_${outputName}`;
            tempFilePath = path.join(this.outputDir, tempFileName);

            const pdfBytesUpdated = await pdfDoc.save();
            await fs.promises.writeFile(tempFilePath, pdfBytesUpdated);

            console.log(`PDF saved temporarily to: ${tempFilePath}`);

            // Upload to S3 using S3Utils
            const s3Key = S3Utils.generatePDFKey(outputName);
            const uploadResult = await S3Utils.uploadBuffer(Buffer.from(pdfBytesUpdated), s3Key, 'application/pdf', {
                originalTemplate: templateName,
                fieldsProcessed: processedFields.toString(),
                generatedAt: new Date().toISOString(),
            });

            console.log(`PDF uploaded to S3 successfully: ${uploadResult.s3Url}`);

            return {
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url,
                localPath: tempFilePath,
                fileSize: pdfBytesUpdated.length,
            };
        } catch (error: any) {
            console.error('Error in fillPDF:', error);

            // Clean up temporary file if it exists
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    await fs.promises.unlink(tempFilePath);
                    console.log(`Cleaned up temporary file: ${tempFilePath}`);
                } catch (cleanupError) {
                    console.error(`Error cleaning up temporary file: ${cleanupError}`);
                }
            }

            throw new Error(`Error filling PDF: ${error.message}`);
        }
    }

    // Use S3Utils for S3 operations
    async downloadFromS3(s3Key: string): Promise<Buffer> {
        return await S3Utils.downloadFile(s3Key);
    }

    async deleteFromS3(s3Key: string): Promise<void> {
        return await S3Utils.deleteFile(s3Key);
    }

    async listS3Files(prefix?: string): Promise<
        Array<{
            key: string;
            size: number;
            lastModified: Date;
            url: string;
        }>
    > {
        return await S3Utils.listFiles(prefix);
    }

    private async loadPDFDocument(inputPath: string): Promise<Uint8Array> {
        try {
            return await fs.promises.readFile(inputPath);
        } catch (error: any) {
            throw new Error(`Failed to read PDF template: ${error.message}`);
        }
    }

    private async processField(
        field: PDFField,
        pages: any[],
        pageCount: number,
        font: any,
        fontSize: number,
        fontColor: any,
        pdfDoc: PDFDocument,
        fieldIndex: number,
    ): Promise<boolean> {
        const pageIndex = field.page !== undefined ? field.page : 0;

        // Validate page index
        if (pageIndex < 0 || pageIndex >= pageCount) {
            console.warn(
                `Field ${fieldIndex}: Page ${pageIndex} does not exist in document with ${pageCount} pages. Field skipped.`,
            );
            return false;
        }

        const page = pages[pageIndex];

        if (field.contentType === 'text' && field.text) {
            return this.processTextField(field, page, font, fontSize, fontColor, fieldIndex);
        } else if (field.contentType === 'image' && field.imageUrl) {
            return await this.processImageField(field, page, pdfDoc, fieldIndex);
        } else {
            console.warn(`Field ${fieldIndex}: Invalid content type or missing required data.`);
            return false;
        }
    }

    private processTextField(
        field: PDFField,
        page: any,
        font: any,
        fontSize: number,
        fontColor: any,
        fieldIndex: number,
    ): boolean {
        try {
            page.drawText(field.text!, {
                x: field.x,
                y: field.y,
                size: fontSize,
                color: fontColor,
                font: font,
            });

            console.log(
                `Field ${fieldIndex}: Text "${field.text!.substring(0, 50)}${field.text!.length > 50 ? '...' : ''}" added at (${field.x}, ${field.y})`,
            );
            return true;
        } catch (error: any) {
            console.error(`Field ${fieldIndex}: Error adding text - ${error.message}`);
            return false;
        }
    }

    private async processImageField(
        field: PDFField,
        page: any,
        pdfDoc: PDFDocument,
        fieldIndex: number,
    ): Promise<boolean> {
        try {
            console.log(`Field ${fieldIndex}: Processing image URL: ${field.imageUrl}`);

            // Fetch image with timeout and size limits
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(field.imageUrl!, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'PDF-Filler-Service/1.0',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > this.maxImageSize) {
                throw new Error(
                    `Image size (${contentLength} bytes) exceeds maximum allowed size (${this.maxImageSize} bytes)`,
                );
            }

            const contentType = response.headers.get('content-type');
            console.log(`Field ${fieldIndex}: Response content type: ${contentType}`);

            const imageBytes = await response.arrayBuffer();

            // Validate image size after download
            if (imageBytes.byteLength > this.maxImageSize) {
                throw new Error(`Downloaded image size (${imageBytes.byteLength} bytes) exceeds maximum allowed size`);
            }

            const image = await this.embedImage(imageBytes, contentType, field.imageUrl!, fieldIndex, pdfDoc);

            const imgWidth = field.width || image.width;
            const imgHeight = field.height || image.height;

            // Validate dimensions
            if (imgWidth <= 0 || imgHeight <= 0) {
                throw new Error('Image dimensions must be positive numbers');
            }

            page.drawImage(image, {
                x: field.x,
                y: field.y,
                width: imgWidth,
                height: imgHeight,
            });

            console.log(
                `Field ${fieldIndex}: Image successfully embedded at (${field.x}, ${field.y}) with dimensions ${imgWidth}x${imgHeight}`,
            );
            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error(`Field ${fieldIndex}: Image download timeout`);
            } else {
                console.error(`Field ${fieldIndex}: Error processing image - ${error.message}`);
            }
            return false;
        }
    }

    private async embedImage(
        imageBytes: ArrayBuffer,
        contentType: string | null,
        imageUrl: string,
        fieldIndex: number,
        pdfDoc: PDFDocument,
    ): Promise<any> {
        // Try to determine image type from content type first
        if (contentType?.includes('image/jpeg') || contentType?.includes('image/jpg')) {
            return await pdfDoc.embedJpg(imageBytes);
        } else if (contentType?.includes('image/png')) {
            return await pdfDoc.embedPng(imageBytes);
        }

        // Fallback to URL extension check
        const urlLower = imageUrl.toLowerCase();
        if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
            return await pdfDoc.embedJpg(imageBytes);
        } else if (urlLower.endsWith('.png')) {
            return await pdfDoc.embedPng(imageBytes);
        }

        // Final fallback: check magic bytes
        const bytes = new Uint8Array(imageBytes).slice(0, 8);
        const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJPG = bytes[0] === 0xff && bytes[1] === 0xd8;

        console.log(`Field ${fieldIndex}: Magic bytes check - isPNG: ${isPNG}, isJPG: ${isJPG}`);

        if (isPNG) {
            return await pdfDoc.embedPng(imageBytes);
        } else if (isJPG) {
            return await pdfDoc.embedJpg(imageBytes);
        } else {
            throw new Error('Unsupported image format. Only JPG and PNG images are supported.');
        }
    }

    async getTemplateInfo(templateName: string): Promise<{
        name: string;
        pageCount: number;
        pages: Array<{ width: number; height: number }>;
        fileSize?: number;
        lastModified?: Date;
    }> {
        try {
            const inputPath = path.join(this.templatesDir, templateName);

            if (!fs.existsSync(inputPath)) {
                throw new Error(
                    `Template not found: ${templateName}. Please ensure the template exists in the templates directory.`,
                );
            }

            // Get file stats
            const stats = await fs.promises.stat(inputPath);

            // Load PDF and get page information
            const pdfBytes = await fs.promises.readFile(inputPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();

            const pageInfo = pages.map((page, index) => ({
                pageNumber: index,
                width: page.getWidth(),
                height: page.getHeight(),
            }));

            console.log(`Template info retrieved for ${templateName}: ${pages.length} pages`);

            return {
                name: templateName,
                pageCount: pages.length,
                pages: pageInfo,
                fileSize: stats.size,
                lastModified: stats.mtime,
            };
        } catch (error: any) {
            console.error(`Error getting template info for ${templateName}:`, error);
            throw new Error(`Error getting template info: ${error.message}`);
        }
    }

    /**
     * Clean up old local temporary files
     */
    async cleanupLocalFiles(maxAgeHours: number = 1): Promise<{
        deletedCount: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let deletedCount = 0;

        try {
            if (!fs.existsSync(this.outputDir)) {
                return { deletedCount: 0, errors: [] };
            }

            const files = await fs.promises.readdir(this.outputDir);
            const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

            for (const file of files) {
                try {
                    const filePath = path.join(this.outputDir, file);
                    const stats = await fs.promises.stat(filePath);

                    if (stats.mtime.getTime() < cutoffTime) {
                        await fs.promises.unlink(filePath);
                        deletedCount++;
                        console.log(`Deleted old temporary file: ${file}`);
                    }
                } catch (error: any) {
                    errors.push(`Error deleting file ${file}: ${error.message}`);
                }
            }
        } catch (error: any) {
            errors.push(`Error during cleanup: ${error.message}`);
        }

        return { deletedCount, errors };
    }

    /**
     * Clean up old S3 files using S3Utils
     */
    async cleanupS3Files(maxAgeHours: number = 24 * 7): Promise<{
        deletedCount: number;
        errors: string[];
    }> {
        return await S3Utils.cleanupOldFiles(maxAgeHours);
    }

    /**
     * Get service statistics including S3 files
     */
    async getStatistics(): Promise<{
        templatesCount: number;
        s3FilesCount: number;
        totalS3Size: number;
        localTempFilesCount: number;
        templatesDirectory: string;
        outputDirectory: string;
        s3Bucket: string;
    }> {
        try {
            let templatesCount = 0;
            let localTempFilesCount = 0;

            // Count templates
            if (fs.existsSync(this.templatesDir)) {
                const templateFiles = await fs.promises.readdir(this.templatesDir);
                templatesCount = templateFiles.filter((file) => file.toLowerCase().endsWith('.pdf')).length;
            }

            // Count local temp files
            if (fs.existsSync(this.outputDir)) {
                const outputFiles = await fs.promises.readdir(this.outputDir);
                localTempFilesCount = outputFiles.length;
            }

            // Get S3 statistics using S3Utils
            const s3Stats = await S3Utils.getBucketStats();

            return {
                templatesCount,
                s3FilesCount: s3Stats.pdfFilesCount,
                totalS3Size: s3Stats.totalPdfSize,
                localTempFilesCount,
                templatesDirectory: this.templatesDir,
                outputDirectory: this.outputDir,
                s3Bucket: s3Stats.bucket,
            };
        } catch (error: any) {
            throw new Error(`Error getting statistics: ${error.message}`);
        }
    }

    /**
     * Test S3 connectivity using S3Utils
     */
    async testS3Connection(): Promise<{ success: boolean; error?: string }> {
        return await S3Utils.testConnection();
    }
}

export default new PDFService();
