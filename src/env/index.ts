import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: process.env.PORT || '3000',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        name: process.env.DB_NAME || 'postgres',
    },
};
