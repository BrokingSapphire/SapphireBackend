import { BadRequestError } from '@app/apiError';
import { env } from '@app/env';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { RequestHandler } from 'express';
import { Request, Response } from '@app/types';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import jwt from 'jsonwebtoken';
import * as core from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types';

const s3 = new S3Client({ region: env.aws.region });

const keyFunction = (_req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void): void => {
    const fileName = Date.now() + '_' + file.fieldname + '_' + file.originalname;
    cb(null, fileName);
};

const metadataFunction = (_req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void): void => {
    cb(null, {
        fieldName: file.fieldname,
        uploaded: new Date().toISOString(),
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
    });
};

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const fileExts = ['.png', '.jpg', '.jpeg', '.gif'];

    const isAllowedExt = fileExts.includes(path.extname(file.originalname.toLowerCase()));

    const isAllowedMimeType = file.mimetype.startsWith('image/');

    if (isAllowedExt && isAllowedMimeType) {
        return cb(null, true);
    } else {
        cb(new BadRequestError('File type not allowed!'));
    }
};

const pdfFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const fileExt = path.extname(file.originalname.toLowerCase());

    const isAllowedExt = fileExt === '.pdf';
    const isAllowedMimeType = file.mimetype === 'application/pdf';

    if (isAllowedExt && isAllowedMimeType) {
        return cb(null, true);
    } else {
        cb(new BadRequestError('Only PDF files are allowed!'));
    }
};

const imageUpload = multer({
    storage: multerS3({
        s3,
        bucket: env.aws.s3_bucket,
        acl: 'public-read',
        metadata: metadataFunction,
        key: keyFunction,
    }),
    fileFilter: imageFilter,
});

const pdfUpload = multer({
    storage: multerS3({
        s3,
        bucket: env.aws.s3_bucket,
        acl: 'public-read',
        metadata: metadataFunction,
        key: keyFunction,
    }),
    fileFilter: pdfFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
    },
});

type MulterReturnType<ReqBody> = {
    file: Express.MulterS3.File;
    body: ReqBody;
};

type MulterHandler<
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
> = (
    req: Request<A, P, ResBody, ReqBody, ReqQuery, Locals>,
    res: Response<ResBody, Locals>,
) => Promise<MulterReturnType<ReqBody>>;

const wrappedMulterHandler = <
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
>(
    handler: RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>,
): MulterHandler<A, P, ResBody, ReqBody, ReqQuery, Locals> => {
    return async (
        req: Request<A, P, ResBody, ReqBody, ReqQuery, Locals>,
        res: Response<ResBody, Locals>,
    ): Promise<MulterReturnType<ReqBody>> => {
        return new Promise(async (resolve, reject) => {
            await handler(req, res, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({ file: req.file! as Express.MulterS3.File, body: req.body });
            });
        });
    };
};

// === PDF SERVICE S3 UTILITIES ===

/**
 * S3 utilities for PDF service operations
 */
export class S3Utils {
    private static bucketName = env.aws.s3_bucket;
    private static region = env.aws.region;

    /**
     * Upload buffer to S3
     */
    static async uploadBuffer(
        buffer: Buffer,
        key: string,
        contentType: string = 'application/pdf',
        metadata?: Record<string, string>,
    ): Promise<{ s3Key: string; s3Url: string }> {
        try {
            const uploadCommand = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                ACL: 'public-read',
                Metadata: {
                    uploadedAt: new Date().toISOString(),
                    service: 'pdf-filler',
                    ...metadata,
                },
            });

            await s3.send(uploadCommand);

            const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

            return { s3Key: key, s3Url };
        } catch (error: any) {
            throw new Error(`Failed to upload to S3: ${error.message}`);
        }
    }

    /**
     * Download file from S3
     */
    static async downloadFile(s3Key: string): Promise<Buffer> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
            });

            const response = await s3.send(command);

            if (!response.Body) {
                throw new Error('No file content received from S3');
            }

            // Convert stream to buffer
            const chunks: Uint8Array[] = [];
            const stream = response.Body as any;

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            return Buffer.concat(chunks);
        } catch (error: any) {
            throw new Error(`Failed to download from S3: ${error.message}`);
        }
    }

    /**
     * Delete file from S3
     */
    static async deleteFile(s3Key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
            });

            await s3.send(command);
            console.log(`Deleted file from S3: ${s3Key}`);
        } catch (error: any) {
            throw new Error(`Failed to delete from S3: ${error.message}`);
        }
    }

    /**
     * List files from S3 with optional prefix
     */
    static async listFiles(prefix: string = 'pdfs/filled/'): Promise<
        Array<{
            key: string;
            size: number;
            lastModified: Date;
            url: string;
        }>
    > {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
            });

            const response = await s3.send(command);

            if (!response.Contents) {
                return [];
            }

            return response.Contents.map((item) => ({
                key: item.Key!,
                size: item.Size || 0,
                lastModified: item.LastModified || new Date(),
                url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${item.Key}`,
            }));
        } catch (error: any) {
            throw new Error(`Failed to list S3 files: ${error.message}`);
        }
    }

    /**
     * Generate S3 key for PDF files
     */
    static generatePDFKey(filename: string): string {
        const timestamp = Date.now();
        const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `pdfs/filled/${timestamp}_${cleanFilename}`;
    }

    /**
     * Generate S3 URL
     */
    static generateS3Url(key: string): string {
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }

    /**
     * Extract filename from S3 key
     */
    static extractFilename(s3Key: string): string {
        return s3Key.split('/').pop() || 'unknown';
    }

    /**
     * Test S3 connectivity
     */
    static async testConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                MaxKeys: 1,
            });

            await s3.send(command);
            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: `S3 connection failed: ${error.message}`,
            };
        }
    }

    /**
     * Get bucket statistics
     */
    static async getBucketStats(): Promise<{
        bucket: string;
        region: string;
        pdfFilesCount: number;
        totalPdfSize: number;
        error?: string;
    }> {
        try {
            const files = await this.listFiles('pdfs/filled/');

            return {
                bucket: this.bucketName,
                region: this.region,
                pdfFilesCount: files.length,
                totalPdfSize: files.reduce((total, file) => total + file.size, 0),
            };
        } catch (error: any) {
            return {
                bucket: this.bucketName,
                region: this.region,
                pdfFilesCount: 0,
                totalPdfSize: 0,
                error: `Failed to get bucket stats: ${error.message}`,
            };
        }
    }

    /**
     * Cleanup old PDF files from S3
     */
    static async cleanupOldFiles(maxAgeHours: number = 24 * 7): Promise<{
        deletedCount: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let deletedCount = 0;

        try {
            const files = await this.listFiles('pdfs/filled/');
            const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

            for (const file of files) {
                try {
                    if (file.lastModified.getTime() < cutoffTime) {
                        await this.deleteFile(file.key);
                        deletedCount++;
                        console.log(`Deleted old S3 file: ${file.key}`);
                    }
                } catch (error: any) {
                    errors.push(`Error deleting S3 file ${file.key}: ${error.message}`);
                }
            }
        } catch (error: any) {
            errors.push(`Error during S3 cleanup: ${error.message}`);
        }

        return { deletedCount, errors };
    }

    /**
     * Get S3 client instance (for advanced operations)
     */
    static getS3Client(): S3Client {
        return s3;
    }

    /**
     * Get bucket configuration
     */
    static getConfig() {
        return {
            bucket: this.bucketName,
            region: this.region,
        };
    }
}

// Export existing multer functionality
export { imageUpload, pdfUpload, wrappedMulterHandler };
