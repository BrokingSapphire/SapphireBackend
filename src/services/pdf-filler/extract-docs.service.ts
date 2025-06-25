// src/services/extract-docs.service.ts

import logger from '@app/logger';
import s3Service from '@app/services/s3.service';
import { db } from '@app/database';
import axios from 'axios';

export interface CachedDocument {
    type: 'pan-verification' | 'income-proof';
    buffer: Buffer;
    fileName: string;
}

export interface DocumentExtractionResult {
    success: boolean;
    documents: CachedDocument[];
    error?: string;
}

/**
 * Simple service for extracting PAN and Income Proof documents
 */
class DocumentExtractionService {
    /**
     * Extract and cache user documents in RAM
     */
    public async extractAndCacheUserDocuments(email: string): Promise<DocumentExtractionResult> {
        try {
            const documents: CachedDocument[] = [];

            // Get document URLs from database
            const userData = await db
                .selectFrom('signup_checkpoints')
                .select(['pan_document', 'pan_document_issuer', 'income_proof', 'income_proof_type'])
                .where('email', '=', email)
                .executeTakeFirst();

            if (!userData) {
                return { success: true, documents: [] };
            }

            const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');

            // Download PAN document if available
            if (userData.pan_document) {
                try {
                    const buffer = await this.downloadDocument(userData.pan_document);
                    documents.push({
                        type: 'pan-verification',
                        buffer,
                        fileName: `${emailPrefix}_pan_verification.pdf`,
                    });
                    logger.info('PAN document cached', { email });
                } catch (error) {
                    logger.error('Failed to download PAN document', { email, error });
                }
            }

            // Download Income Proof if available
            if (userData.income_proof) {
                try {
                    const buffer = await this.downloadDocument(userData.income_proof);
                    documents.push({
                        type: 'income-proof',
                        buffer,
                        fileName: `${emailPrefix}_income_proof.pdf`,
                    });
                    logger.info('Income proof cached', { email });
                } catch (error) {
                    logger.error('Failed to download income proof', { email, error });
                }
            }

            return { success: true, documents };
        } catch (error: any) {
            logger.error('Error extracting documents', { email, error: error.message });
            return { success: false, documents: [], error: error.message };
        }
    }

    /**
     * Download document from URL (S3 or external)
     */
    private async downloadDocument(url: string): Promise<Buffer> {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 20 * 1024 * 1024, // 20MB max
        });

        return Buffer.from(response.data);
    }

    /**
     * Check if user has any documents
     */
    public async hasDocuments(email: string): Promise<boolean> {
        try {
            const userData = await db
                .selectFrom('signup_checkpoints')
                .select(['pan_document', 'income_proof'])
                .where('email', '=', email)
                .executeTakeFirst();

            return !!(userData?.pan_document || userData?.income_proof);
        } catch (error) {
            return false;
        }
    }
}

export default new DocumentExtractionService();
