import { db } from '@app/database';
import logger from '@app/logger';
import { Server } from 'http';
/**
 * Close the server and database connections and exit the process.
 * @param {import('http').Server} server - The server object to close.
 * @returns {Promise<void>} - A promise that resolves when the server and database connections are closed and the process is exited.
 */
const gracefulShutdown = async (server: Server) => {
    try {
        await db.destroy();
        logger.info('Closed database connection!');
        await server.close();
        process.exit();
    } catch (error: any) {
        logger.error(error.message);
        process.exit(1);
    }
};

export default gracefulShutdown;
