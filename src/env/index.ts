import dotenv from 'dotenv';

dotenv.config();

interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
}

interface EnvConfig {
    port: number;
    db: DatabaseConfig;
}

export const env: EnvConfig = {
    port: Number(process.env.PORT) || 3000,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        name: process.env.DB_NAME || 'postgres',
    },
};
