// src/types/pdfFiller.types.ts

/**
 * Represents a field to be filled in the PDF
 */
export interface PDFField {
    /** Text content for text fields */
    text?: string;
    /** Image URL for image fields */
    imageUrl?: string;
    /** X coordinate for field placement */
    x: number;
    /** Y coordinate for field placement */
    y: number;
    /** Page number (0-indexed), defaults to 0 */
    page?: number;
    /** Width for image sizing */
    width?: number;
    /** Height for image sizing */
    height?: number;
    /** Content type to determine how to process the field */
    contentType: 'text' | 'image';
    /** Optional field identifier for tracking */
    id?: string;
    /** Optional field description */
    description?: string;
}

/**
 * PDF styling and formatting options
 */
export interface PDFOptions {
    /** Font size for text fields (6-72) */
    fontSize?: number;
    /** Font color in RGB values (0-1) */
    fontColor?: {
        r: number;
        g: number;
        b: number;
    };
    /** Font name from standard fonts */
    fontName?: StandardFontName;
    /** Whether to preserve aspect ratio for images */
    preserveAspectRatio?: boolean;
    /** Image quality (0-1) for JPEG images */
    imageQuality?: number;
}

/**
 * Standard PDF fonts supported by pdf-lib
 */
export type StandardFontName =
    | 'Helvetica'
    | 'Helvetica-Bold'
    | 'Helvetica-Oblique'
    | 'Helvetica-BoldOblique'
    | 'Times-Roman'
    | 'Times-Bold'
    | 'Times-Italic'
    | 'Times-BoldItalic'
    | 'Courier'
    | 'Courier-Bold'
    | 'Courier-Oblique'
    | 'Courier-BoldOblique';

/**
 * Request payload for filling PDF
 */
export interface PDFFillRequest {
    /** Name of the template file */
    templateName: string;
    /** Optional custom output filename */
    outputName?: string;
    /** Array of fields to fill in the PDF */
    fields: PDFField[];
    /** Optional styling and formatting options */
    options?: PDFOptions;
}

/**
 * Response for successful PDF fill operation with S3 storage
 */
export interface PDFFillResponse {
    success: boolean;
    message: string;
    data: {
        /** S3 key of the filled PDF file */
        s3Key: string;
        /** S3 URL of the filled PDF file */
        s3Url: string;
        /** Final filename of the generated PDF */
        fileName: string;
        /** File size in bytes */
        fileSize: number;
        /** Number of fields that were processed */
        fieldsProcessed: number;
        /** Download URL for the generated PDF */
        downloadUrl: string;
    };
}

/**
 * S3 file information
 */
export interface S3FileInfo {
    /** S3 key (path) of the file */
    key: string;
    /** File size in bytes */
    size: number;
    /** Last modified date */
    lastModified: Date;
    /** Public URL of the file */
    url: string;
}

/**
 * S3 upload result
 */
export interface S3UploadResult {
    /** S3 key where file was uploaded */
    s3Key: string;
    /** Public URL of the uploaded file */
    s3Url: string;
}

/**
 * PDF fill result with S3 storage
 */
export interface PDFFillResult {
    /** S3 key of the uploaded file */
    s3Key: string;
    /** S3 URL of the uploaded file */
    s3Url: string;
    /** Local temporary file path */
    localPath: string;
    /** File size in bytes */
    fileSize: number;
}

/**
 * Service statistics including S3 usage
 */
export interface ServiceStatistics {
    /** Number of available templates */
    templatesCount: number;
    /** Number of S3 files */
    s3FilesCount: number;
    /** Total size of S3 files in bytes */
    totalS3Size: number;
    /** Number of local temporary files */
    localTempFilesCount: number;
    /** Path to templates directory */
    templatesDirectory: string;
    /** Path to output directory */
    outputDirectory: string;
    /** S3 bucket name */
    s3Bucket: string;
}

/**
 * Health check data structure
 */
export interface HealthCheckData {
    /** Whether templates directory exists */
    templatesDirectory: boolean;
    /** Whether output directory exists */
    outputDirectory: boolean;
    /** Whether templates directory is writable */
    templatesWritable: boolean;
    /** Whether output directory is writable */
    outputWritable: boolean;
    /** Whether S3 is accessible */
    s3Connectivity: boolean;
    /** Server uptime in seconds */
    uptime: number;
    /** Timestamp of health check */
    timestamp: string;
}

/**
 * Health check response including S3 connectivity
 */
export interface HealthCheckResponse {
    success: boolean;
    message: string;
    data: HealthCheckData;
}

/**
 * S3 files list response
 */
export interface S3FilesListResponse {
    success: boolean;
    message: string;
    data: {
        /** Array of S3 file information */
        files: S3FileInfo[];
        /** Total count of files */
        count: number;
        /** Total size of all files */
        totalSize: number;
    };
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
    /** Number of files deleted */
    deletedCount: number;
    /** Array of errors encountered during cleanup */
    errors: string[];
}

/**
 * Combined cleanup results
 */
export interface CombinedCleanupResult {
    success: boolean;
    message: string;
    data: {
        /** Local cleanup results */
        local: CleanupResult;
        /** S3 cleanup results */
        s3: CleanupResult;
        /** Summary of cleanup operation */
        summary: {
            /** Total files deleted across all locations */
            totalDeleted: number;
            /** Total errors encountered */
            totalErrors: number;
            /** Cleanup completion time */
            cleanupTime: string;
        };
    };
}

/**
 * Template information response
 */
export interface TemplateInfo {
    /** Template filename */
    name: string;
    /** Number of pages in the template */
    pageCount: number;
    /** Information about each page */
    pages: PageInfo[];
    /** File size in bytes */
    fileSize?: number;
    /** Last modification date */
    lastModified?: Date;
}

/**
 * Information about a PDF page
 */
export interface PageInfo {
    /** Page number (0-indexed) */
    pageNumber?: number;
    /** Page width in points */
    width: number;
    /** Page height in points */
    height: number;
}

/**
 * Template validation result
 */
export interface TemplateValidation {
    /** Whether the template is valid */
    isValid: boolean;
    /** Array of validation errors */
    errors: string[];
    /** Array of validation warnings */
    warnings: string[];
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
    /** Whether the operation was successful */
    success: boolean;
    /** Response message */
    message: string;
    /** Response data */
    data?: T;
    /** Error message if operation failed */
    error?: string;
    /** Timestamp of the response */
    timestamp?: string;
}

/**
 * Error response format
 */
export interface ErrorResponse {
    success: false;
    error: string;
    /** Additional error details */
    details?: ValidationError[];
    /** Timestamp when error occurred */
    timestamp: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
    /** Field name that failed validation */
    field: string;
    /** Validation error message */
    message: string;
    /** Value that failed validation */
    value?: any;
}

/**
 * Template list response
 */
export interface TemplateListResponse {
    success: boolean;
    message: string;
    data: {
        /** Array of template information */
        templates: (TemplateInfo & { error?: string })[];
        /** Total count of templates */
        count: number;
    };
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
    /** Maximum image size in bytes */
    maxSize?: number;
    /** Timeout for image download in milliseconds */
    timeout?: number;
    /** Whether to validate image format */
    validateFormat?: boolean;
    /** Supported image formats */
    supportedFormats?: string[];
}

/**
 * Field processing result
 */
export interface FieldProcessingResult {
    /** Field index */
    index: number;
    /** Whether field was processed successfully */
    success: boolean;
    /** Error message if processing failed */
    error?: string;
    /** Processing duration in milliseconds */
    duration?: number;
}

/**
 * PDF processing summary
 */
export interface ProcessingSummary {
    /** Total number of fields */
    totalFields: number;
    /** Number of successfully processed fields */
    processedFields: number;
    /** Number of skipped fields */
    skippedFields: number;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Array of field processing results */
    fieldResults?: FieldProcessingResult[];
}
