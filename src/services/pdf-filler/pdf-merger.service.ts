// src/services/pdf-merger.service.ts

import { PDFDocument } from 'pdf-lib';
import logger from '@app/logger';
import s3Service from '@app/services/s3.service';
import documentExtractionService, { CachedDocument } from './extract-docs.service';
import PDFDataFetcherService from './pdf-data-fetcher.service';

export interface MergedPDFResult {
    success: boolean;
    aofNumber?: string;
    s3Key?: string;
    s3Url?: string;
    fileName?: string;
    mergedDocuments?: string[];
    totalPages?: number;
    error?: string;
}

export interface MergeOptions {
    includeOriginalForm?: boolean;
    customFileName?: string;
    folder?: string;
    metadata?: Record<string, string>;
}

/**
 * Service for merging PDF documents with user's filled AOF form
 */
class PDFMergerService {
    /**
     * Complete PDF generation and merging workflow
     */
    public async generateAndMergeUserPDF(email: string, options: MergeOptions = {}): Promise<MergedPDFResult> {
        try {
            logger.info(`Starting complete PDF generation and merge for: ${email}`);

            // Step 1: Generate the filled AOF form
            const formResult = await PDFDataFetcherService.generateUserPDF(email);

            if (!formResult.success || !formResult.s3Key) {
                return {
                    success: false,
                    error: `Failed to generate AOF form: ${formResult.error}`,
                };
            }

            // Step 2: Extract and cache user documents
            const documentsResult = await documentExtractionService.extractAndCacheUserDocuments(email);

            if (!documentsResult.success) {
                logger.warn(`Failed to extract documents for ${email}, proceeding with form only`);
            }

            // Step 3: Download the generated form from S3
            const formBuffer = await s3Service.downloadFileAsBuffer(formResult.s3Key);

            // Step 4: Merge all documents
            const mergeResult = await this.mergeDocuments(formBuffer.buffer, documentsResult.documents, email, options);

            logger.info(`Complete PDF workflow completed for: ${email}`, {
                success: mergeResult.success,
                totalPages: mergeResult.totalPages,
                mergedDocuments: mergeResult.mergedDocuments?.length || 0,
            });

            return mergeResult;
        } catch (error: any) {
            logger.error(`Error in complete PDF workflow for ${email}:`, error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Merge multiple PDF documents into a single PDF
     */
    public async mergeDocuments(
        mainFormBuffer: Buffer,
        additionalDocuments: CachedDocument[],
        email: string,
        options: MergeOptions = {},
    ): Promise<MergedPDFResult> {
        try {
            logger.info(`Starting PDF merge for ${email}`, {
                additionalDocuments: additionalDocuments.length,
            });

            // Create new PDF document for merging
            const mergedPdf = await PDFDocument.create();
            const mergedDocuments: string[] = [];
            let totalPages = 0;

            // Step 1: Add the main AOF form
            const mainFormPdf = await PDFDocument.load(mainFormBuffer);
            const mainFormPages = await mergedPdf.copyPages(mainFormPdf, mainFormPdf.getPageIndices());

            mainFormPages.forEach((page) => mergedPdf.addPage(page));
            totalPages += mainFormPages.length;
            mergedDocuments.push('AOF Form');

            logger.info(`Added main AOF form: ${mainFormPages.length} pages`);

            // Step 2: Add PAN verification document
            const panDoc = additionalDocuments.find((doc) => doc.type === 'pan-verification');
            if (panDoc) {
                try {
                    const panPdf = await PDFDocument.load(panDoc.buffer);
                    const panPages = await mergedPdf.copyPages(panPdf, panPdf.getPageIndices());

                    panPages.forEach((page) => mergedPdf.addPage(page));
                    totalPages += panPages.length;
                    mergedDocuments.push('PAN Verification');

                    logger.info(`Added PAN verification: ${panPages.length} pages`);
                } catch (error) {
                    logger.error(`Failed to merge PAN document for ${email}:`, error);
                }
            }

            // Step 3: Add Aadhaar verification document

            const aadhaarDoc = additionalDocuments.find((doc) => doc.type === 'aadhaar-verification');
            if (aadhaarDoc) {
                try {
                    const aadhaarPdf = await PDFDocument.load(aadhaarDoc.buffer);
                    const aadhaarPages = await mergedPdf.copyPages(aadhaarPdf, aadhaarPdf.getPageIndices());

                    aadhaarPages.forEach((page) => mergedPdf.addPage(page));
                    totalPages += aadhaarPages.length;
                    mergedDocuments.push('Aadhaar Verification');

                    logger.info(`Added Aadhaar verification: ${aadhaarPages.length} pages`);
                } catch (error) {
                    logger.error(`Failed to merge Aadhaar document for ${email}:`, error);
                }
            }

            // Step 4: Add Income Proof document
            const incomeDoc = additionalDocuments.find((doc) => doc.type === 'income-proof');
            if (incomeDoc) {
                try {
                    const incomePdf = await PDFDocument.load(incomeDoc.buffer);
                    const incomePages = await mergedPdf.copyPages(incomePdf, incomePdf.getPageIndices());

                    incomePages.forEach((page) => mergedPdf.addPage(page));
                    totalPages += incomePages.length;
                    mergedDocuments.push('Income Proof');

                    logger.info(`Added income proof: ${incomePages.length} pages`);
                } catch (error) {
                    logger.error(`Failed to merge income document for ${email}:`, error);
                }
            }

            // Step 5: Add metadata to merged PDF
            mergedPdf.setTitle('Complete Account Opening Form with Supporting Documents');
            mergedPdf.setSubject('Client Onboarding Documentation');
            mergedPdf.setCreator('AOF Generation Service');
            mergedPdf.setProducer('PDF Merger Service');
            mergedPdf.setCreationDate(new Date());
            mergedPdf.setModificationDate(new Date());

            // Step 5: Generate final PDF buffer
            const mergedPdfBytes = await mergedPdf.save();
            const mergedBuffer = Buffer.from(mergedPdfBytes);

            // Step 6: Generate filename and upload to S3
            const sanitizedEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = options.customFileName || `${sanitizedEmail}_complete_aof_${timestamp}.pdf`;

            const uploadResult = await s3Service.uploadFromBuffer(mergedBuffer, fileName, {
                folder: options.folder || 'merged-aof-documents',
                contentType: 'application/pdf',
                metadata: {
                    'user-email': email,
                    'document-type': 'complete-aof-package',
                    'merged-documents': mergedDocuments.join(','),
                    'total-pages': totalPages.toString(),
                    'generated-date': new Date().toISOString(),
                    ...options.metadata,
                },
            });

            logger.info(`Successfully merged and uploaded PDF for ${email}`, {
                fileName,
                s3Key: uploadResult.key,
                totalPages,
                mergedDocuments,
            });

            return {
                success: true,
                s3Key: uploadResult.key,
                s3Url: uploadResult.url,
                fileName,
                mergedDocuments,
                totalPages,
            };
        } catch (error: any) {
            logger.error(`Error merging PDFs for ${email}:`, error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Merge only specific document types
     */
    public async mergeSpecificDocuments(
        email: string,
        documentTypes: ('pan-verification' | 'income-proof' | 'aadhaar-verification')[],
        options: MergeOptions = {},
    ): Promise<MergedPDFResult> {
        try {
            logger.info(`Merging specific documents for ${email}:`, documentTypes);

            // Generate main form if requested or by default
            let mainFormBuffer: Buffer | null = null;
            if (options.includeOriginalForm !== false) {
                const formResult = await PDFDataFetcherService.generateUserPDF(email);
                if (formResult.success && formResult.s3Key) {
                    const formData = await s3Service.downloadFileAsBuffer(formResult.s3Key);
                    mainFormBuffer = formData.buffer;
                }
            }

            // Extract documents
            const documentsResult = await documentExtractionService.extractAndCacheUserDocuments(email);

            if (!documentsResult.success) {
                return {
                    success: false,
                    error: `Failed to extract documents: ${documentsResult.error}`,
                };
            }

            // Filter documents by requested types
            const filteredDocuments = documentsResult.documents.filter((doc) => documentTypes.includes(doc.type));

            if (!mainFormBuffer && filteredDocuments.length === 0) {
                return {
                    success: false,
                    error: 'No documents to merge',
                };
            }

            // If no main form, create empty PDF and merge documents
            if (!mainFormBuffer) {
                const emptyPdf = await PDFDocument.create();
                const emptyPdfBytes = await emptyPdf.save();
                mainFormBuffer = Buffer.from(emptyPdfBytes);
            }

            return this.mergeDocuments(mainFormBuffer, filteredDocuments, email, options);
        } catch (error: any) {
            logger.error(`Error merging specific documents for ${email}:`, error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get document availability status for a user
     */
    public async getDocumentStatus(email: string): Promise<{
        hasDocuments: boolean;
        availableDocuments: string[];
        canGenerateForm: boolean;
    }> {
        try {
            const hasDocuments = await documentExtractionService.hasDocuments(email);
            const availableDocuments: string[] = [];

            if (hasDocuments) {
                const documentsResult = await documentExtractionService.extractAndCacheUserDocuments(email);
                if (documentsResult.success) {
                    availableDocuments.push(...documentsResult.documents.map((doc) => doc.type));
                }
            }

            // Check if we can generate the main form
            let canGenerateForm = false;
            try {
                await PDFDataFetcherService.fetchSignupDataForPDF(email);
                canGenerateForm = true;
            } catch (error) {
                logger.debug(`Cannot generate form for ${email}:`, error);
            }

            return {
                hasDocuments,
                availableDocuments,
                canGenerateForm,
            };
        } catch (error: any) {
            logger.error(`Error getting document status for ${email}:`, error);
            return {
                hasDocuments: false,
                availableDocuments: [],
                canGenerateForm: false,
            };
        }
    }

    /**
     * Batch process multiple users
     */
    public async batchMergeUserPDFs(
        emails: string[],
        options: MergeOptions = {},
    ): Promise<Record<string, MergedPDFResult>> {
        const results: Record<string, MergedPDFResult> = {};

        logger.info(`Starting batch PDF merge for ${emails.length} users`);

        for (const email of emails) {
            try {
                results[email] = await this.generateAndMergeUserPDF(email, options);

                // Add small delay to prevent overwhelming the system
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error: any) {
                logger.error(`Batch merge failed for ${email}:`, error);
                results[email] = {
                    success: false,
                    error: error.message,
                };
            }
        }

        const successCount = Object.values(results).filter((r) => r.success).length;
        logger.info(`Batch merge completed: ${successCount}/${emails.length} successful`);

        return results;
    }

    /**
     * Get PDF page count
     */
    public async getPDFPageCount(buffer: Buffer): Promise<number> {
        try {
            const pdf = await PDFDocument.load(buffer);
            return pdf.getPageCount();
        } catch (error) {
            return 0;
        }
    }

    /**
     * Cleanup old merged PDFs (utility method)
     */
    public async cleanupOldMergedPDFs(olderThanDays: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const files = await s3Service.listFiles('merged-aof-documents/');

            for (const file of files) {
                if (file.lastModified < cutoffDate) {
                    try {
                        await s3Service.deleteFile(file.key);
                        logger.info(`Deleted old merged PDF: ${file.key}`);
                    } catch (error) {
                        logger.error(`Failed to delete old PDF ${file.key}:`, error);
                    }
                }
            }
        } catch (error: any) {
            logger.error('Error during PDF cleanup:', error);
        }
    }
}

export default new PDFMergerService();
