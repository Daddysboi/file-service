import winston from 'winston';
import { inspect } from 'util';

// Custom formatter that handles errors
const errorFormatter = winston.format((info) => {
  if (info instanceof Error) {
    return {
      ...info,
      message: info.message,
      stack: info.stack,
      details: inspect(info, { depth: 5, colors: true }),
    };
  }
  return info;
});

const isProduction = process.env.MODE === 'production';

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errorFormatter(),
      isProduction
        ? winston.format.json()
        : winston.format.printf(({ timestamp, level, message, stack, ...rest }) => {
            let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
            if (stack) log += `\n${stack}`;
            if (Object.keys(rest).length) {
              log += `\n${inspect(rest, { depth: 5, colors: true })}`;
            }
            return log;
          }),
    ),
    handleExceptions: true,
    handleRejections: true,
  }),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), errorFormatter(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(winston.format.timestamp(), errorFormatter(), winston.format.json()),
    }),
  );
}

interface ExtendedLogger extends winston.Logger {
  httpStream?: { write: (message: string) => void };
}

const logger: ExtendedLogger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  transports,
  exitOnError: false,
});

// Morgan-like HTTP request logging
logger.httpStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
