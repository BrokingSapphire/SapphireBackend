import morgan from 'morgan';
import { NextFunction, Request, Response } from 'express';
import logger from '@app/logger';

// Custom token for request body
morgan.token('body', (req: Request) => JSON.stringify(req.body));

// Custom token for response body
morgan.token('response-body', (_req: Request, res: Response) => {
    const body = res.locals.body;
    return body ? JSON.stringify(body) : '';
});

// Format for successful requests
const routeLogger = morgan(':method :url :status :response-time ms - :res[content-length] :body :response-body', {
    skip: (_req, res) => res.statusCode >= 400,
    stream: {
        write: (message) => logger.info(message.trim()),
    },
});

// Format for error requests
const errorLogger = morgan(':method :url :status :response-time ms - :res[content-length] :body :response-body', {
    skip: (_req, res) => res.statusCode < 400,
    stream: {
        write: (message) => logger.error(message.trim()),
    },
});

// Middleware to capture response body
const responseCapture = (_req: Request, res: Response, next: NextFunction) => {
    const oldSend = res.send;
    res.send = function (body) {
        res.locals.body = body;
        return oldSend.call(this, body);
    };
    next();
};

export { routeLogger, errorLogger, responseCapture };
