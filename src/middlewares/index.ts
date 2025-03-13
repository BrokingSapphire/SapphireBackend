import logRoutes from '@app/middlewares/logRoutes';
import logError from '@app/middlewares/errorLogger';
import errorHandler from '@app/middlewares/errorHandler';
import notFoundErrorHandler from '@app/middlewares/notFoundError';
import validate from '@app/middlewares/validator';
import { routeLogger, errorLogger, responseCapture } from './morgan';

export { logRoutes, logError, errorHandler, notFoundErrorHandler, validate, routeLogger, errorLogger, responseCapture };
