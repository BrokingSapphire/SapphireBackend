import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import { env } from '@app/env';
import { logRoutes } from '@app/middlewares';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());
app.use(csurf());

app.use(logRoutes);

app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
});

export default app;
