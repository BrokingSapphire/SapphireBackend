import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logRoutes, errorLogger, errorHandler, notFoundErrorHandler } from '@app/middlewares';
import fundsRoutes from './modules/funds/funds.routes';
import signupRoutes from './modules/signup/signup.routes';

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Mount routes
app.use('/api/funds', fundsRoutes);
app.use('/api/signup', signupRoutes);

// Error handling middleware
app.use(logRoutes);
app.use(errorLogger);
app.use(errorHandler);
app.use(notFoundErrorHandler);

export default app;
