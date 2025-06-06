// src/routes/pdfFiller.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import PDFController from '@app/modules/pdfFiller/pdfFiller.controller';
import PDFFillerValidator from '@app/modules/pdfFiller/pdfFiller.validator';
import { pdfUpload } from '@app/services/multer-s3.service';

const router = Router();

/**
 * @route   POST /api/pdf/fill
 * @desc    Fill PDF template with provided data and store in S3
 * @access  Public
 * @body    { templateName, outputName?, fields, options? }
 */
router.post(
    '/fill',
    PDFFillerValidator.fillPDFRules(),
    PDFFillerValidator.handleValidationErrors,
    PDFFillerValidator.validateFieldDependencies,
    PDFController.fillPDF,
);

/**
 * @route   GET /api/pdf/download-s3/:s3Key
 * @desc    Download filled PDF file from S3
 * @access  Public
 * @params  s3Key - S3 key of the PDF file to download (URL encoded)
 */
router.get('/download-s3/:s3Key', PDFController.downloadFromS3);

/**
 * @route   GET /api/pdf/download/:filename
 * @desc    Download filled PDF file from local storage (legacy support)
 * @access  Public
 * @params  filename - Name of the PDF file to download
 */
router.get(
    '/download/:filename',
    PDFFillerValidator.downloadPDFRules(),
    PDFFillerValidator.handleValidationErrors,
    PDFController.downloadPDF,
);

/**
 * @route   GET /api/pdf/template/:templateName
 * @desc    Get information about a specific template
 * @access  Public
 * @params  templateName - Name of the template file
 */
router.get(
    '/template/:templateName',
    PDFFillerValidator.getTemplateInfoRules(),
    PDFFillerValidator.handleValidationErrors,
    PDFController.getTemplateInfo,
);

/**
 * @route   GET /api/pdf/templates
 * @desc    List all available templates
 * @access  Public
 */
router.get('/templates', PDFController.listTemplates);

/**
 * @route   POST /api/pdf/templates/upload
 * @desc    Upload a new PDF template
 * @access  Public
 */
router.post('/templates/upload', pdfUpload.single('template'), PDFController.uploadTemplate);

/**
 * @route   GET /api/pdf/s3/files
 * @desc    List all S3 files
 * @access  Public
 */
router.get('/s3/files', PDFController.listS3Files);

/**
 * @route   DELETE /api/pdf/s3/:s3Key
 * @desc    Delete file from S3
 * @access  Public
 * @params  s3Key - S3 key of the file to delete (URL encoded)
 */
router.delete('/s3/:s3Key', PDFController.deleteS3File);

/**
 * @route   POST /api/pdf/cleanup
 * @desc    Cleanup old files (local and/or S3)
 * @access  Public
 * @query   maxAgeHours - Maximum age in hours (default: 24)
 * @query   cleanupLocal - Whether to cleanup local files (default: true)
 * @query   cleanupS3 - Whether to cleanup S3 files (default: false)
 */
router.post('/cleanup', PDFController.cleanupFiles);

/**
 * @route   GET /api/pdf/statistics
 * @desc    Get service statistics including S3 usage
 * @access  Public
 */
router.get('/statistics', PDFController.getStatistics);

/**
 * @route   GET /api/pdf/health
 * @desc    Health check for PDF service including S3 connectivity
 * @access  Public
 */
router.get('/health', PDFController.healthCheck);

export default router;
