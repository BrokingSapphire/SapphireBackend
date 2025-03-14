import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: process.env.PORT || '3000',
    env: process.env.NODE_ENV || 'development',
    apiPath: process.env.API_PATH || '/api/v1',
    database: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres',
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    jwt: {
        secret: process.env.JWT_SECRET || 'secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
    sms: {
        apiKey: process.env.MOBIGLITZ_API_KEY || 'key',
        senderId: process.env.MOBIGLITZ_SENDER_ID || 'sender_id',
    },
    surepass: {
        apiKey: process.env.SUREPASS_API_KEY || 'key',
    },
    aws: {
        region: process.env.AWS_REGION || 'region',
        s3_bucket: process.env.AWS_S3_BUCKET || 'bucket',
    },
};
