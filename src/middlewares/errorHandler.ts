import { DatabaseError } from 'pg';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@app/logger';
import { APIError } from '@app/apiError';
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@app/utils/httpstatus';

interface ErrorResponse {
    error: {
        code: number;
        message: string;
    };
}

/**
 * Error handling middleware for Express
 *
 * @param {Error} error - The error object
 * @param {Request} _req - The Express request object
 * @param {Response} res - The Express response object
 * @param {NextFunction} _next - The next middleware function
 */
const errorHandler = (
    error: unknown,
    _req: Request,
    res: Response<ErrorResponse>,
    _next: NextFunction,
): Response<ErrorResponse> => {
    logger.error(error);

    // catch api error
    if (error instanceof APIError) {
        return res.status(error.status).json({
            error: {
                code: error.status,
                message: error.message,
            },
        });
    }

    // catch db error
    if (error instanceof DatabaseError) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            // unique_violation
            return res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Duplicate entry',
                },
            });
        }

        // Handle foreign key violations
        if (error.code === '23503') {
            // foreign_key_violation
            return res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Invalid reference',
                },
            });
        }

        // Handle check constraint violations
        if (error.code === '23514') {
            // check_violation
            return res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Validation failed',
                },
            });
        }

        // Handle not null violations
        if (error.code === '23502') {
            // not_null_violation
            return res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Required field missing',
                },
            });
        }
    }

    // catch all errors
    return res.status(INTERNAL_SERVER_ERROR).json({
        error: {
            code: INTERNAL_SERVER_ERROR,
            message: 'Something went wrong!',
        },
    });
};

export default errorHandler;
