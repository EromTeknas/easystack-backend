import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { logDir, logLevel } from '../config/app';

const { combine, timestamp, printf, colorize } = winston.format;

const logsPath = path.resolve(process.cwd(), logDir || 'storage/logs');

const queueLogFormat = printf(({ timestamp, level, message, queue, jobId, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [Queue:${queue}] [Job:${jobId || '-'}] [${level}] ${message}${metaStr}`;
});

export const createQueueLogger = (queueName: string) => {
  return winston.createLogger({
    level: logLevel || 'debug',
    format: combine(
      timestamp(),
      winston.format((info) => { info.queue = queueName; return info; })(),
      queueLogFormat
    ),
    transports: [
      new winston.transports.Console({
        format: combine(colorize(), timestamp(), queueLogFormat)
      }),
      new DailyRotateFile({
        dirname: logsPath,
        filename: `${queueName}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
      })
    ]
  });
};
