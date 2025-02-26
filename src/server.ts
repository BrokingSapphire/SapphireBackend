import http from 'http';
import stoppable from 'stoppable';
import app from '@app/app';
import normalizePort from '@app/utils/normalize-port';
import gracefulShutdown from '@app/utils/graceful-shutdown';
import logger from '@app/logger';
import { env } from '@app/env';

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(env.port);
app.set('port', port);

/**
 * Create HTTP server.
 */
const server: http.Server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);

/**
 * Handle server errors.
 * @param {NodeJS.ErrnoException} error - The error to handle.
 * @throws {Error} - If the error is not a listen error or is not a known error code.
 */
function onError(error: NodeJS.ErrnoException): void {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
        case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening(): void {
    const addr = server.address();
    if (!addr) return;

    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
    logger.info(`Listening on ${bind} in ${env.env} environment`);
}

server.on('error', onError);
server.on('listening', onListening);

// quit on ctrl+c when running docker in terminal
process.on('SIGINT', async () => {
    logger.info(`Got SIGINT (aka ctrl+c in docker). Graceful shutdown ${new Date().toISOString()}`);
    await gracefulShutdown(stoppable(server));
});

// quit properly on docker stop
process.on('SIGTERM', async () => {
    logger.info(`Got SIGTERM (docker container stop). Graceful shutdown ${new Date().toISOString()}`);
    await gracefulShutdown(stoppable(server));
});
