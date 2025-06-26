export interface UploadOptions {
    key?: string;
    folder?: string;
    contentType?: string;
    metadata?: Record<string, string>;
    cacheControl?: string;
    expires?: Date;
}

export interface UploadResult {
    key: string;
    url: string;
    bucket: string;
    location: string;
    etag?: string;
}

export interface FileInfo {
    key: string;
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface DownloadResult {
    buffer: Buffer;
    contentType?: string;
    size: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
}
