// src/validators/pdfFiller.validator.ts
import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export class PDFFillerValidator {
    // Validation rules for filling PDF
    static fillPDFRules() {
        return [
            body('templateName')
                .notEmpty()
                .withMessage('Template name is required')
                .isString()
                .withMessage('Template name must be a string')
                .matches(/^[a-zA-Z0-9._-]+\.pdf$/i)
                .withMessage('Template name must be a valid PDF filename'),

            body('outputName')
                .optional()
                .isString()
                .withMessage('Output name must be a string')
                .matches(/^[a-zA-Z0-9._-]+\.pdf$/i)
                .withMessage('Output name must be a valid PDF filename'),

            body('fields').isArray({ min: 1 }).withMessage('Fields must be a non-empty array'),

            body('fields.*.contentType')
                .isIn(['text', 'image'])
                .withMessage('Content type must be either "text" or "image"'),

            body('fields.*.x')
                .isNumeric()
                .withMessage('X coordinate must be a number')
                .isFloat({ min: 0 })
                .withMessage('X coordinate must be non-negative'),

            body('fields.*.y')
                .isNumeric()
                .withMessage('Y coordinate must be a number')
                .isFloat({ min: 0 })
                .withMessage('Y coordinate must be non-negative'),

            body('fields.*.page').optional().isInt({ min: 0 }).withMessage('Page must be a non-negative integer'),

            body('fields.*.text')
                .if(body('fields.*.contentType').equals('text'))
                .notEmpty()
                .withMessage('Text is required when content type is "text"')
                .isString()
                .withMessage('Text must be a string')
                .isLength({ max: 1000 })
                .withMessage('Text must not exceed 1000 characters'),

            body('fields.*.imageUrl')
                .if(body('fields.*.contentType').equals('image'))
                .notEmpty()
                .withMessage('Image URL is required when content type is "image"')
                .isURL({ protocols: ['http', 'https'] })
                .withMessage('Image URL must be a valid HTTP/HTTPS URL'),

            body('fields.*.width')
                .optional()
                .isNumeric()
                .withMessage('Width must be a number')
                .isFloat({ min: 1, max: 2000 })
                .withMessage('Width must be between 1 and 2000 pixels'),

            body('fields.*.height')
                .optional()
                .isNumeric()
                .withMessage('Height must be a number')
                .isFloat({ min: 1, max: 2000 })
                .withMessage('Height must be between 1 and 2000 pixels'),

            // Options validation
            body('options.fontSize')
                .optional()
                .isNumeric()
                .withMessage('Font size must be a number')
                .isFloat({ min: 6, max: 72 })
                .withMessage('Font size must be between 6 and 72'),

            body('options.fontColor.r')
                .optional()
                .isFloat({ min: 0, max: 1 })
                .withMessage('Font color red component must be between 0 and 1'),

            body('options.fontColor.g')
                .optional()
                .isFloat({ min: 0, max: 1 })
                .withMessage('Font color green component must be between 0 and 1'),

            body('options.fontColor.b')
                .optional()
                .isFloat({ min: 0, max: 1 })
                .withMessage('Font color blue component must be between 0 and 1'),

            body('options.fontName')
                .optional()
                .isString()
                .withMessage('Font name must be a string')
                .isIn([
                    'Helvetica',
                    'Helvetica-Bold',
                    'Helvetica-Oblique',
                    'Helvetica-BoldOblique',
                    'Times-Roman',
                    'Times-Bold',
                    'Times-Italic',
                    'Times-BoldItalic',
                    'Courier',
                    'Courier-Bold',
                    'Courier-Oblique',
                    'Courier-BoldOblique',
                ])
                .withMessage('Font name must be a valid standard font'),
        ];
    }

    // Validation rules for template info
    static getTemplateInfoRules() {
        return [
            param('templateName')
                .notEmpty()
                .withMessage('Template name is required')
                .isString()
                .withMessage('Template name must be a string')
                .matches(/^[a-zA-Z0-9._-]+\.pdf$/i)
                .withMessage('Template name must be a valid PDF filename'),
        ];
    }

    // Validation rules for download PDF
    static downloadPDFRules() {
        return [
            param('filename')
                .notEmpty()
                .withMessage('Filename is required')
                .isString()
                .withMessage('Filename must be a string')
                .matches(/^[a-zA-Z0-9._-]+\.pdf$/i)
                .withMessage('Filename must be a valid PDF filename'),
        ];
    }

    // Middleware to handle validation errors
    static handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const formattedErrors = errors.array().map((error) => ({
                field: error.type === 'field' ? error.path : 'general',
                message: error.msg,
                value: error.type === 'field' ? (error as any).value : undefined,
            }));

            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: formattedErrors,
            });
            return;
        }

        next();
    }

    // Custom validation for field dependencies
    static validateFieldDependencies(req: Request, res: Response, next: NextFunction): void {
        const { fields } = req.body;

        if (!Array.isArray(fields)) {
            next();
            return;
        }

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            // Validate text fields
            if (field.contentType === 'text') {
                if (!field.text || typeof field.text !== 'string') {
                    res.status(400).json({
                        success: false,
                        error: `Field at index ${i}: Text is required and must be a string when contentType is "text"`,
                    });
                    return;
                }
            }

            // Validate image fields
            if (field.contentType === 'image') {
                if (!field.imageUrl || typeof field.imageUrl !== 'string') {
                    res.status(400).json({
                        success: false,
                        error: `Field at index ${i}: ImageUrl is required and must be a string when contentType is "image"`,
                    });
                    return;
                }

                // Basic URL validation
                try {
                    new URL(field.imageUrl);
                } catch {
                    res.status(400).json({
                        success: false,
                        error: `Field at index ${i}: ImageUrl must be a valid URL`,
                    });
                    return;
                }
            }

            // Validate coordinates
            if (typeof field.x !== 'number' || field.x < 0) {
                res.status(400).json({
                    success: false,
                    error: `Field at index ${i}: X coordinate must be a non-negative number`,
                });
                return;
            }

            if (typeof field.y !== 'number' || field.y < 0) {
                res.status(400).json({
                    success: false,
                    error: `Field at index ${i}: Y coordinate must be a non-negative number`,
                });
                return;
            }

            // Validate optional dimensions for images
            if (field.contentType === 'image') {
                if (field.width !== undefined && (typeof field.width !== 'number' || field.width <= 0)) {
                    res.status(400).json({
                        success: false,
                        error: `Field at index ${i}: Width must be a positive number`,
                    });
                    return;
                }

                if (field.height !== undefined && (typeof field.height !== 'number' || field.height <= 0)) {
                    res.status(400).json({
                        success: false,
                        error: `Field at index ${i}: Height must be a positive number`,
                    });
                    return;
                }
            }
        }

        next();
    }
}

export default PDFFillerValidator;
