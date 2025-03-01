import logRoutes from '@app/middlewares/logRoutes';
import errorLogger from '@app/middlewares/errorLogger';
import errorHandler from '@app/middlewares/errorHandler';
import notFoundErrorHandler from '@app/middlewares/notFoundError';
import validate from '@app/middlewares/validator';

export { logRoutes, errorLogger, errorHandler, notFoundErrorHandler, validate };
