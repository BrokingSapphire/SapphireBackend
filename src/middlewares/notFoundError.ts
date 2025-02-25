import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@app/apiError';

/**
 * Middleware to handle not found errors.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function
 */
const notFoundErrorHandler = (req: Request, _res: Response, _next: NextFunction): void => {
    const errorMessage = `Not Found: ${req.method} on ${req.url}`;
    throw new NotFoundError(errorMessage);
};

export default notFoundErrorHandler;
