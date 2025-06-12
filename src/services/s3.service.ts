import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { env } from '@app/env';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { UploadOptions, UploadResult, FileInfo } from './types/s3.types';

class S3Service {
    private readonly s3Client: S3Client;
    private readonly bucket: string;

    constructor() {
        this.s3Client = new S3Client({
            region: env.aws.region,
        });
        this.bucket = env.aws.s3_bucket;
    }

    /**
     * Upload a file to S3 from a buffer
     */
    async uploadFromBuffer(buffer: Buffer, originalName: string, options: UploadOptions = {}): Promise<UploadResult> {
        const key = this.generateKey(originalName, options);
        const contentType = options.contentType || this.getContentType(originalName);

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            Metadata: options.metadata,
            CacheControl: options.cacheControl,
            Expires: options.expires,
        });

        const response = await this.s3Client.send(command);

        return {
            key,
            url: this.getPublicUrl(key),
            bucket: this.bucket,
            location: `s3://${this.bucket}/${key}`,
            etag: response.ETag,
        };
    }

    /**
     * Upload a file to S3 from a readable stream
     */
    async uploadFromStream(stream: Readable, originalName: string, options: UploadOptions = {}): Promise<UploadResult> {
        const key = this.generateKey(originalName, options);
        const contentType = options.contentType || this.getContentType(originalName);

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: stream,
            ContentType: contentType,
            Metadata: options.metadata,
            CacheControl: options.cacheControl,
            Expires: options.expires,
        });

        const response = await this.s3Client.send(command);

        return {
            key,
            url: this.getPublicUrl(key),
            bucket: this.bucket,
            location: `s3://${this.bucket}/${key}`,
            etag: response.ETag,
        };
    }

    /**
     * Upload a file to S3 from local file path
     */
    async uploadFromFile(filePath: string, originalName: string, options: UploadOptions = {}): Promise<UploadResult> {
        const stream = createReadStream(filePath);
        return this.uploadFromStream(stream, originalName, options);
    }

    /**
     * Upload a file to S3 from base64 string
     */
    async uploadFromBase64(
        base64Data: string,
        originalName: string,
        options: UploadOptions = {},
    ): Promise<UploadResult> {
        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64String, 'base64');

        return this.uploadFromBuffer(buffer, originalName, options);
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.s3Client.send(command);
    }

    /**
     * Get file information
     */
    async getFileInfo(key: string): Promise<FileInfo> {
        const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.s3Client.send(command);

        return {
            key,
            size: response.ContentLength || 0,
            lastModified: response.LastModified || new Date(),
            contentType: response.ContentType,
            metadata: response.Metadata,
        };
    }

    /**
     * Check if file exists
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            await this.getFileInfo(key);
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get public URL for a file (works only if bucket has public read access)
     */
    getPublicDownloadUrl(key: string): string {
        return this.getPublicUrl(key);
    }

    /**
     * Generate a presigned upload URL (requires manual implementation if needed)
     * This method returns the key that should be used for direct upload
     */
    generateUploadKey(originalName: string, options: UploadOptions = {}): string {
        return this.generateKey(originalName, options);
    }

    /**
     * List files in a folder
     */
    async listFiles(prefix?: string, maxKeys?: number): Promise<FileInfo[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            MaxKeys: maxKeys,
        });

        const response = await this.s3Client.send(command);

        return (response.Contents || []).map((object) => ({
            key: object.Key || '',
            size: object.Size || 0,
            lastModified: object.LastModified || new Date(),
        }));
    }

    /**
     * Copy a file within S3
     */
    async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
        const command = new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${sourceKey}`,
            Key: destinationKey,
        });

        const response = await this.s3Client.send(command);

        return {
            key: destinationKey,
            url: this.getPublicUrl(destinationKey),
            bucket: this.bucket,
            location: `s3://${this.bucket}/${destinationKey}`,
            etag: response.CopyObjectResult?.ETag,
        };
    }

    /**
     * Move a file within S3 (copy then delete)
     */
    async moveFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
        const result = await this.copyFile(sourceKey, destinationKey);
        await this.deleteFile(sourceKey);
        return result;
    }

    /**
     * Generate a unique key for the file
     */
    private generateKey(originalName: string, options: UploadOptions): string {
        if (options.key) {
            return options.folder ? `${options.folder}/${options.key}` : options.key;
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = this.getFileExtension(originalName);
        const baseName = this.sanitizeFileName(originalName.replace(/\.[^/.]+$/, ''));

        const fileName = `${baseName}-${timestamp}-${randomString}${extension}`;

        return options.folder ? `${options.folder}/${fileName}` : fileName;
    }

    /**
     * Get file extension from filename
     */
    private getFileExtension(filename: string): string {
        const match = filename.match(/\.[^/.]+$/);
        return match ? match[0] : '';
    }

    /**
     * Sanitize filename to remove invalid characters
     */
    private sanitizeFileName(filename: string): string {
        return filename
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(filename: string): string {
        const extension = this.getFileExtension(filename).toLowerCase();

        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
        };

        return mimeTypes[extension] || 'application/octet-stream';
    }

    /**
     * Get public URL for a file
     */
    private getPublicUrl(key: string): string {
        return `https://${this.bucket}.s3.${env.aws.region}.amazonaws.com/${key}`;
    }

    /**
     * Validate file size
     */
    validateFileSize(buffer: Buffer, maxSizeInBytes: number): boolean {
        return buffer.length <= maxSizeInBytes;
    }

    /**
     * Validate file type
     */
    validateFileType(filename: string, allowedTypes: string[]): boolean {
        const extension = this.getFileExtension(filename).toLowerCase();
        return allowedTypes.includes(extension);
    }
}

export type { UploadOptions, UploadResult, FileInfo } from './types/s3.types';

export default new S3Service();
