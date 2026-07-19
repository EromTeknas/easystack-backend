import fs from 'fs';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getRequestId } from './request-context';
import { logLevel, logDir, logIdentifier, environment } from '../config/app';

const { combine, timestamp, printf, colorize } = winston.format;

const logsPath = path.resolve(process.cwd(), logDir || 'storage/logs');
try {
  fs.mkdirSync(logsPath, { recursive: true });
} catch (err) {
  // ignore
}

const addRequestId = winston.format((info) => {
  info.requestId = getRequestId() ?? '-';
  info.service = logIdentifier ?? 'service';
  info.environment = environment ?? 'unknown';
  return info;
});

const logFormat = printf(({ timestamp, level, message, requestId, service, environment, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const errStack = stack ? `\n${stack}` : '';
  return `${timestamp} [${service}] [${environment}] [${level}] [req:${requestId}] ${message}${metaStr}${errStack}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({ format: combine(colorize(), timestamp(), addRequestId(), logFormat) }),
];

if (DailyRotateFile) {
  transports.push(
    new DailyRotateFile({
      dirname: logsPath,
      filename: `${logIdentifier || 'app'}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: logLevel,
      format: combine(timestamp(), addRequestId(), logFormat),
    })
  );
} else {
  // warn once that rotation transport is not installed
  // eslint-disable-next-line no-console
  console.warn('winston-daily-rotate-file not installed — logs will not be rotated to files');
}

const logger = winston.createLogger({ level: logLevel, transports });

export default logger;

export type Logger = winston.Logger;
