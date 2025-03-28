import { DatabaseError } from 'pg';
import { NextFunction, Request, Response } from 'express';
import logger from '@app/logger';
import { APIError } from '@app/apiError';
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from '@app/utils/httpstatus';
import { env } from '@app/env';
import { NoResultError } from 'kysely';

interface ErrorResponse {
    error: {
        code: number;
        message: string;
        details?: string[];
    };
}

/**
 * Error handling middleware for Express
 *
 * @param {Error} error - The error object
 * @param {Request} _req - The Express request object
 * @param {Response} res - The Express response object
 * @param {NextFunction} next - The next middleware function
 */
const errorHandler = (error: unknown, _req: Request, res: Response<ErrorResponse>, next: NextFunction): void => {
    logger.error(error);

    if (res.headersSent) {
        return next(error);
    }

    // catch api error
    if (error instanceof APIError) {
        res.status(error.status).json({
            error: {
                code: error.status,
                message: error.message,
            },
        });
        return;
    }

    if (error instanceof NoResultError) {
        res.status(NOT_FOUND).json({
            error: {
                code: NOT_FOUND,
                message: 'No result found',
            },
        });
        return;
    }

    // catch db error
    if (error instanceof DatabaseError) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            // unique_violation
            res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Duplicate entry',
                },
            });
            return;
        }

        // Handle foreign key violations
        if (error.code === '23503') {
            // foreign_key_violation
            res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Invalid reference',
                },
            });
            return;
        }

        // Handle check constraint violations
        if (error.code === '23514') {
            // check_violation
            res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Validation failed',
                },
            });
            return;
        }

        // Handle not null violations
        if (error.code === '23502') {
            // not_null_violation
            res.status(BAD_REQUEST).json({
                error: {
                    code: BAD_REQUEST,
                    message: 'Required field missing',
                },
            });
            return;
        }
    }

    // catch all errors
    res.status(INTERNAL_SERVER_ERROR).json({
        error: {
            code: INTERNAL_SERVER_ERROR,
            message: 'Something went wrong!',
            details: env.env === 'development' ? getErrorDetails(error) : undefined,
        },
    });
};

function getErrorDetails(error: unknown): string[] {
    const details: string[] = [];

    if (error instanceof Error) {
        details.push(error.message);

        // Add cause chain if available
        let currentError = error.cause as Error | undefined;
        while (currentError) {
            details.push(`Caused by: ${currentError.message}`);
            currentError = currentError.cause as Error | undefined;
        }

        // Add stack trace for developer debugging
        if (error.stack) {
            details.push(error.stack.split('\n')[0]);
        }
    }

    return details.length ? details : ['Unknown error'];
}

export default errorHandler;
