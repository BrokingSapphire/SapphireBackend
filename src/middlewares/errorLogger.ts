import winston from 'winston';
import expressWinston from 'express-winston';

const errorLogger = expressWinston.errorLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.json()),
});

export default errorLogger;
