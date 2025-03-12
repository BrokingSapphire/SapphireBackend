import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { logRoutes, errorLogger, errorHandler, notFoundErrorHandler } from '@app/middlewares';
import expressWs from 'express-ws';
import { initializeRedis, closeRedisConnection } from '@app/services/redis.service';
import { setupSwagger } from '@app/swagger';
import router from '@app/modules';

const app = express();

expressWs(app);

app.use(helmet());
app.use(cors());
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(router);

// Setup Swagger before routes
setupSwagger(app);

app.use(logRoutes);
app.use(errorLogger);
app.use(errorHandler);
app.use(notFoundErrorHandler);

app.use(csurf());

app.on('listening', async () => {
    await initializeRedis();
});

app.on('close', async () => {
    await closeRedisConnection();
});

export default app;
