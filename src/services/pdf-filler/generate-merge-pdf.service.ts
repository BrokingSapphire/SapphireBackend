// src/services/pdf-filler/generate-merge-pdf.service.ts

import { db } from '@app/database';
import logger from '@app/logger';
import pdfMergerService from '@app/services/pdf-filler/pdf-merger.service';
import s3Service from '../s3.service';

export async function generateMergedPDFAsync(email: string): Promise<string | null> {
    const sanitizedEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const customFileName = `complete_aof_${sanitizedEmail}_${timestamp}.pdf`;

    // Generate and merge PDF
    const result = await pdfMergerService.generateAndMergeUserPDF(email, {
        customFileName,
        folder: 'aof-documents',
        metadata: {
            'document-type': 'complete-aof-package',
            'auto-generated': 'true',
            'triggered-by': 'esign-initialization',
            'user-email': email,
            'generated-date': new Date().toISOString(),
        },
    });

    if (result.success && result.s3Key) {
        let accessibleUrl: string | null = result.s3Url ?? null;

        try {
            const presignedUrl =
                (await s3Service.generatePresignedUrl(result.s3Key, {
                    expiresIn: 24 * 60 * 60, // 24 hours
                    responseContentType: 'application/pdf',
                    responseContentDisposition: `inline; filename="${result.fileName}"`,
                })) ?? null;

            if (presignedUrl) {
                accessibleUrl = presignedUrl;
                logger.info(`Generated pre-signed URL for ${email}`);
            }
        } catch (urlError: any) {
            logger.warn(`Failed to generate pre-signed URL for ${email}:`, urlError.message);
        }

        // Generate unique AOF number
        const aofNumber = `AOF${Date.now()}${Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0')}`;

        const aofRecord = await db
            .insertInto('account_openform')
            .values({
                aof_number: aofNumber,
                merged_aof_document: accessibleUrl,
                merged_aof_generated_at: new Date(),
            })
            .returning('id')
            .executeTakeFirst();

        // Update signup_checkpoints
        await db
            .updateTable('signup_checkpoints')
            .set({
                account_openform_id: aofRecord?.id,
            })
            .where('email', '=', email)
            .execute();

        logger.info(`Automatic PDF generation completed for ${email}`, {
            aofNumber,
            aofRecordId: aofRecord?.id,
            fileName: result.fileName,
            s3Key: result.s3Key,
            hasPresignedUrl: accessibleUrl !== result.s3Url,
        });

        await logPDFGenerationForESign(email, result);

        return accessibleUrl;
    } else {
        logger.error(`Automatic PDF generation failed for ${email}:`, result.error);

        await db.updateTable('signup_checkpoints').set({ doubt: true }).where('email', '=', email).execute();

        return null;
    }
}

async function logPDFGenerationForESign(email: string, pdfResult: any): Promise<void> {
    try {
        logger.info(`PDF ready for eSign workflow - ${email}`, {
            fileName: pdfResult.fileName,
            s3Key: pdfResult.s3Key,
            totalPages: pdfResult.totalPages,
            mergedDocuments: pdfResult.mergedDocuments,
            readyForESign: true,
        });

        // Update verification status
        await db
            .updateTable('signup_verification_status')
            .set({
                updated_at: new Date(),
            })
            .where(
                'id',
                '=',
                (
                    await db
                        .selectFrom('signup_checkpoints')
                        .select('id')
                        .where('email', '=', email)
                        .executeTakeFirstOrThrow()
                ).id,
            )
            .execute();
    } catch (error: any) {
        logger.error(`Failed to update eSign workflow status for ${email}:`, error);
    }
}
