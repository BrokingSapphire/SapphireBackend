import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '@app/apiError';

/**
 * Middleware to handle not found errors.
 */
const notFoundErrorHandler = (req: Request, _res: Response, _next: NextFunction): void => {
    const errorMessage = `Not Found: ${req.method} on ${req.url}`;
    throw new NotFoundError(errorMessage);
};

export default notFoundErrorHandler;
