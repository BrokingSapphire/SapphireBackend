import logRoutes from '@app/middlewares/logRoutes';
import logError from '@app/middlewares/errorLogger';
import errorHandler from '@app/middlewares/errorHandler';
import notFoundErrorHandler from '@app/middlewares/notFoundError';
import validate from '@app/middlewares/validator';
import { errorLogger, responseCapture, routeLogger } from './morgan';

export { logRoutes, logError, errorHandler, notFoundErrorHandler, validate, routeLogger, errorLogger, responseCapture };
