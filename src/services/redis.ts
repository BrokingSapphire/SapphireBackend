import { createClient } from 'redis';
import { env } from '@app/env';
import logger from '@app/logger';

const redisClient = createClient({
    url: env.redis,
});

export const initializeRedis = async (): Promise<void> => {
    await redisClient.connect().catch((err: Error) => {
        logger.error('Redis connection error:', err);
        process.exit(1);
    });
    logger.info('Connected to Redis');

    redisClient.on('error', (err: Error) => {
        logger.error('Redis error:', err);
    });
};

export const closeRedisConnection = async (): Promise<void> => {
    await redisClient.quit();
    logger.info('Redis connection closed');
};

export default redisClient;
