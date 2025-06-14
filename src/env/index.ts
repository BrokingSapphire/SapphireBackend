import dotenv from 'dotenv';
import * as process from 'node:process';

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
    email: {
        host: process.env.EMAIL_HOST || 'smtp.email.com',
        port: process.env.EMAIL_PORT || '587',
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || 'noreply@email.com',
        password: process.env.EMAIL_PASS || 'password',
        from: process.env.EMAIL_FROM || 'Email Sender <noreply@email.com>',
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
    ntt: {
        userId: process.env.NTT_USER_ID || '123456',
        transactionPassword: process.env.NTT_TRANSACTION_PASSWORD || 'password',
        productId: process.env.NTT_PRODUCT_ID || 'product_id',
        hashRequestKey: process.env.NTT_HASH_REQUEST_KEY || 'key',
        hashResponseKey: process.env.NTT_HASH_RESPONSE_KEY || 'key',
        aesRequestKey: process.env.NTT_AES_REQUEST_KEY || 'key',
        aesRequestSalt: process.env.NTT_AES_REQUEST_SALT || 'key',
        aesResponseKey: process.env.NTT_AES_RESPONSE_KEY || 'key',
        aesResponseSalt: process.env.NTT_AES_RESPONSE_SALT || 'salt',
        uatBankId: process.env.NTT_UAT_BANK_ID || 'band',
        uatVpa: process.env.NTT_UAT_VPA || 'vpa',
        mccCode: process.env.NTT_MCC_CODE || '1234',
    },
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'project',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'client_email@email.com',
        privateKey: process.env.FIREBASE_PRIVATE_KEY || 'private_key',
        webVapidKey: process.env.FIREBASE_WEB_VAPID_KEY || 'vapid_key',
        senderId: process.env.FIREBASE_SENDER_ID || 'sender_id',
    },
};
