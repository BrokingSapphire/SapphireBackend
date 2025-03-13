import express from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import { routeLogger, errorLogger, responseCapture, errorHandler } from '@app/middlewares';
import expressWs from 'express-ws';
import { initializeRedis, closeRedisConnection } from '@app/services/redis.service';
import { setupSwagger } from '@app/swagger';
import router from '@app/modules';
import { env } from './env';
import logger from '@app/logger';

const app = express();

expressWs(app);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup logging middleware
app.use(responseCapture);
app.use(routeLogger);
app.use(errorLogger);

// Setup Swagger
setupSwagger(app);

// Routes
app.use(env.apiPath, router);
logger.info(`API routes registered at ${env.apiPath}`);

// Error handling
app.use(errorHandler);
app.use(csurf());

app.on('listening', async () => {
    await initializeRedis();
});

app.on('close', async () => {
    await closeRedisConnection();
});

export default app;
