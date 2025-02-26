import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import { logRoutes, errorLogger, errorHandler, notFoundErrorHandler } from '@app/middlewares';
import expressWs from 'express-ws';

const app = express();

expressWs(app);

app.use(helmet());
app.use(cors());
app.use(csurf());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logRoutes);
app.use(errorLogger);
app.use(errorHandler);
app.use(notFoundErrorHandler);

export default app;
