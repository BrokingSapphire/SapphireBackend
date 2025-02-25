import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import { logRoutes, errorLogger, errorHandler } from '@app/middlewares';

const app = express();

app.use(helmet());
app.use(cors());
app.use(csurf());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logRoutes);
app.use(errorLogger);
app.use(errorHandler);

export default app;
