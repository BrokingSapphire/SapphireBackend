import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: process.env.PORT || '3000',
    env: process.env.NODE_ENV || 'development',
    apiPath: process.env.API_PATH || '/api/v1',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        name: process.env.DB_NAME || 'postgres',
    },
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    jwt: {
        secret: process.env.JWT_SECRET || 'secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
};
