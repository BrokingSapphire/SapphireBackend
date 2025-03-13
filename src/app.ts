// app.ts

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fundsRoutes from './modules/funds/funds.routes';
import signupRoutes from './modules/signup/signup.routes';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { logRoutes, errorLogger, errorHandler, notFoundErrorHandler } from '@app/middlewares';
import expressWs from 'express-ws';
import { initializeRedis, closeRedisConnection } from '@app/services/redis.service';
import { setupSwagger } from '@app/swagger';
import router from '@app/modules';

const app = express();

expressWs(app);

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Test JSON endpoint
app.post('/test-json', (req, res) => {
    console.log('Request body:', req.body);
    res.json({ received: req.body });
});

// Setup Swagger
setupSwagger(app);

// Mount routes
app.use('/api/funds', fundsRoutes);
app.use('/api/signup', signupRoutes);
app.use(router);

// Error handling middleware
app.use(logRoutes);
app.use(errorLogger);
app.use(errorHandler);
app.use(notFoundErrorHandler);
app.use(csurf());

// Redis connection handling
app.on('listening', async () => {
    await initializeRedis();
});

app.on('close', async () => {
    await closeRedisConnection();
});

export default app;
