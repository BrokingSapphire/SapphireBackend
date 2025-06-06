// src/controllers/pdfFiller.controller.ts
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import pdfFillerService from '@app/services/pdf-filler.service';
import { PDFFillRequest } from '@app/modules/pdfFiller/pdfFiller.types';

// Use process.cwd() for cross-platform compatibility
const __dirname = process.cwd();

export class PDFController {
    /**
     * Fill PDF with provided fields and options, store result in S3
     */
    async fillPDF(req: Request, res: Response): Promise<void> {
        let tempFilePath: string | null = null;

        try {
            const { templateName, outputName, fields, options } = req.body as PDFFillRequest;

            // Generate unique output name
            const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
            const finalOutputName = outputName ? `${uniqueId}-${outputName}` : `filled_${uniqueId}.pdf`;

            console.log(`Starting PDF fill operation for template: ${templateName}`);
            console.log(`Output file will be: ${finalOutputName}`);
            console.log(`Processing ${fields.length} fields`);

            const result = await pdfFillerService.fillPDF(templateName, finalOutputName, fields, options);
            tempFilePath = result.localPath;

            console.log(`PDF fill operation completed successfully. S3 URL: ${result.s3Url}`);

            // Clean up temporary local file after successful S3 upload
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    await fs.promises.unlink(tempFilePath);
                    console.log(`Cleaned up temporary file: ${tempFilePath}`);
                } catch (cleanupError) {
                    console.warn(`Warning: Could not clean up temporary file: ${cleanupError}`);
                }
            }

            res.status(200).json({
                success: true,
                message: 'PDF filled and uploaded successfully',
                data: {
                    s3Key: result.s3Key,
                    s3Url: result.s3Url,
                    fileName: finalOutputName,
                    fileSize: result.fileSize,
                    fieldsProcessed: fields.length,
                    downloadUrl: `/api/pdf/download-s3/${encodeURIComponent(result.s3Key)}`,
                },
            });
        } catch (error: any) {
            console.error('Error in fillPDF:', error);

            // Clean up temporary file if it exists
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    await fs.promises.unlink(tempFilePath);
                    console.log(`Cleaned up temporary file after error: ${tempFilePath}`);
                } catch (cleanupError) {
                    console.error(`Error cleaning up temporary file: ${cleanupError}`);
                }
            }

            // Provide more specific error messages
            let statusCode = 500;
            let errorMessage = error.message;

            if (error.message.includes('Template not found')) {
                statusCode = 404;
                errorMessage = `Template "${req.body.templateName}" not found. Please check if the template exists in the templates directory.`;
            } else if (error.message.includes('Failed to fetch image')) {
                statusCode = 400;
                errorMessage =
                    'One or more image URLs could not be fetched. Please verify the image URLs are accessible.';
            } else if (error.message.includes('Unsupported image format')) {
                statusCode = 400;
                errorMessage =
                    'One or more images are in an unsupported format. Only JPG and PNG images are supported.';
            } else if (error.message.includes('Failed to upload to S3')) {
                statusCode = 500;
                errorMessage =
                    'PDF was generated successfully but failed to upload to cloud storage. Please try again.';
            }

            res.status(statusCode).json({
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Download PDF file from S3
     */
    async downloadFromS3(req: Request, res: Response): Promise<void> {
        try {
            const { s3Key } = req.params;
            const decodedS3Key = decodeURIComponent(s3Key);

            console.log(`Download request for S3 file: ${decodedS3Key}`);

            const fileBuffer = await pdfFillerService.downloadFromS3(decodedS3Key);

            // Extract filename from S3 key
            const fileName = path.basename(decodedS3Key);

            // Set appropriate headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', fileBuffer.length.toString());

            console.log(`Serving S3 file: ${decodedS3Key}, Size: ${fileBuffer.length} bytes`);
            res.send(fileBuffer);
        } catch (error: any) {
            console.error('Error in downloadFromS3:', error);

            let statusCode = 500;
            let errorMessage = error.message;

            if (error.message.includes('NoSuchKey') || error.message.includes('Not Found')) {
                statusCode = 404;
                errorMessage = 'File not found in cloud storage';
            }

            res.status(statusCode).json({
                success: false,
                error: errorMessage,
                s3Key: req.params.s3Key,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Download filled PDF file (legacy local file support)
     */
    async downloadPDF(req: Request, res: Response): Promise<void> {
        try {
            const { filename } = req.params;
            const outputDir = path.join(__dirname, 'output');
            const filePath = path.join(outputDir, filename);

            console.log(`Legacy download request for file: ${filename}`);

            if (!fs.existsSync(filePath)) {
                console.log(`File not found: ${filePath}`);
                res.status(404).json({
                    success: false,
                    error: 'File not found. Note: New files are stored in cloud storage. Use the S3 download endpoint.',
                    filename: filename,
                    suggestion: 'Use /api/pdf/download-s3/{s3Key} for files created after the S3 migration.',
                });
                return;
            }

            // Set appropriate headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            console.log(`Serving legacy file: ${filePath}`);
            res.download(filePath, (err) => {
                if (err) {
                    console.error('Error serving file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            error: 'Error downloading file',
                        });
                    }
                }
            });
        } catch (error: any) {
            console.error('Error in downloadPDF:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Get template information including page count and dimensions
     */
    async getTemplateInfo(req: Request, res: Response): Promise<void> {
        try {
            const { templateName } = req.params;

            console.log(`Getting template info for: ${templateName}`);

            const templateInfo = await pdfFillerService.getTemplateInfo(templateName);

            console.log(`Template info retrieved successfully for: ${templateName}`);

            res.status(200).json({
                success: true,
                message: 'Template information retrieved successfully',
                data: {
                    ...templateInfo,
                    templatePath: `/templates/${templateName}`,
                    retrievedAt: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            console.error('Error in getTemplateInfo:', error);

            let statusCode = 500;
            let errorMessage = error.message;

            if (error.message.includes('Template not found')) {
                statusCode = 404;
                errorMessage = `Template "${req.params.templateName}" not found. Please check if the template exists in the templates directory.`;
            }

            res.status(statusCode).json({
                success: false,
                error: errorMessage,
                templateName: req.params.templateName,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * List all available templates
     */
    async listTemplates(req: Request, res: Response): Promise<void> {
        try {
            const templatesDir = path.join(__dirname, 'templates');

            if (!fs.existsSync(templatesDir)) {
                res.status(200).json({
                    success: true,
                    message: 'No templates directory found',
                    data: {
                        templates: [],
                        count: 0,
                    },
                });
                return;
            }

            const files = await fs.promises.readdir(templatesDir);
            const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

            const templates = await Promise.all(
                pdfFiles.map(async (filename) => {
                    try {
                        const templateInfo = await pdfFillerService.getTemplateInfo(filename);
                        const filePath = path.join(templatesDir, filename);
                        const stats = await fs.promises.stat(filePath);

                        return {
                            ...templateInfo,
                            fileSize: stats.size,
                            createdAt: stats.birthtime,
                            modifiedAt: stats.mtime,
                        };
                    } catch (error) {
                        console.warn(`Error getting info for template ${filename}:`, error);
                        return {
                            name: filename,
                            error: 'Could not read template information',
                        };
                    }
                }),
            );

            res.status(200).json({
                success: true,
                message: 'Templates retrieved successfully',
                data: {
                    templates,
                    count: templates.length,
                },
            });
        } catch (error: any) {
            console.error('Error in listTemplates:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * List all S3 files
     */
    async listS3Files(req: Request, res: Response): Promise<void> {
        try {
            console.log('Listing S3 files');

            const files = await pdfFillerService.listS3Files();

            res.status(200).json({
                success: true,
                message: 'S3 files retrieved successfully',
                data: {
                    files,
                    count: files.length,
                    totalSize: files.reduce((total, file) => total + file.size, 0),
                },
            });
        } catch (error: any) {
            console.error('Error in listS3Files:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Delete file from S3
     */
    async deleteS3File(req: Request, res: Response): Promise<void> {
        try {
            const { s3Key } = req.params;
            const decodedS3Key = decodeURIComponent(s3Key);

            console.log(`Delete request for S3 file: ${decodedS3Key}`);

            await pdfFillerService.deleteFromS3(decodedS3Key);

            res.status(200).json({
                success: true,
                message: 'File deleted successfully from S3',
                data: {
                    s3Key: decodedS3Key,
                    deletedAt: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            console.error('Error in deleteS3File:', error);

            let statusCode = 500;
            let errorMessage = error.message;

            if (error.message.includes('NoSuchKey') || error.message.includes('Not Found')) {
                statusCode = 404;
                errorMessage = 'File not found in cloud storage';
            }

            res.status(statusCode).json({
                success: false,
                error: errorMessage,
                s3Key: req.params.s3Key,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Cleanup old files (both local and S3)
     */
    async cleanupFiles(req: Request, res: Response): Promise<void> {
        try {
            const { maxAgeHours = 24, cleanupLocal = true, cleanupS3 = false } = req.query;

            console.log(`Starting cleanup - Local: ${cleanupLocal}, S3: ${cleanupS3}, Max Age: ${maxAgeHours}h`);

            const results: any = {
                local: { deletedCount: 0, errors: [] },
                s3: { deletedCount: 0, errors: [] },
            };

            if (cleanupLocal === 'true') {
                results.local = await pdfFillerService.cleanupLocalFiles(Number(maxAgeHours));
            }

            if (cleanupS3 === 'true') {
                results.s3 = await pdfFillerService.cleanupS3Files(Number(maxAgeHours));
            }

            const totalDeleted = results.local.deletedCount + results.s3.deletedCount;
            const totalErrors = results.local.errors.length + results.s3.errors.length;

            res.status(200).json({
                success: true,
                message: `Cleanup completed. Deleted ${totalDeleted} files.`,
                data: {
                    ...results,
                    summary: {
                        totalDeleted,
                        totalErrors,
                        cleanupTime: new Date().toISOString(),
                    },
                },
            });
        } catch (error: any) {
            console.error('Error in cleanupFiles:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Health check endpoint including S3 connectivity
     */
    async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            const templatesDir = path.join(__dirname, 'templates');
            const outputDir = path.join(__dirname, 'output');

            const checks = {
                templatesDirectory: fs.existsSync(templatesDir),
                outputDirectory: fs.existsSync(outputDir),
                templatesWritable: false,
                outputWritable: false,
                s3Connectivity: false,
            };

            // Check if directories are writable
            try {
                await fs.promises.access(templatesDir, fs.constants.W_OK);
                checks.templatesWritable = true;
            } catch {}

            try {
                await fs.promises.access(outputDir, fs.constants.W_OK);
                checks.outputWritable = true;
            } catch {}

            // Check S3 connectivity
            try {
                await pdfFillerService.testS3Connection();
                checks.s3Connectivity = true;
            } catch (s3Error) {
                console.warn('S3 connectivity check failed:', s3Error);
            }

            const isHealthy =
                checks.templatesDirectory &&
                checks.outputDirectory &&
                checks.templatesWritable &&
                checks.outputWritable &&
                checks.s3Connectivity;

            res.status(isHealthy ? 200 : 503).json({
                success: isHealthy,
                message: isHealthy ? 'Service is healthy' : 'Service has issues',
                data: {
                    ...checks,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Get service statistics including S3 usage
     */
    async getStatistics(req: Request, res: Response): Promise<void> {
        try {
            console.log('Getting service statistics');

            const stats = await pdfFillerService.getStatistics();

            res.status(200).json({
                success: true,
                message: 'Statistics retrieved successfully',
                data: {
                    ...stats,
                    retrievedAt: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            console.error('Error in getStatistics:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Upload template to local storage (for template management)
     */
    async uploadTemplate(req: Request, res: Response): Promise<void> {
        try {
            const file = req.file;

            if (!file) {
                res.status(400).json({
                    success: false,
                    error: 'No file provided',
                });
                return;
            }

            // Note: This assumes you're using multer with local storage for templates
            // You might want to modify this to also support S3 template storage

            console.log(`Template uploaded: ${file.filename}`);

            res.status(200).json({
                success: true,
                message: 'Template uploaded successfully',
                data: {
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            console.error('Error in uploadTemplate:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}

export default new PDFController();
