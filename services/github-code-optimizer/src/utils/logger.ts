import winston from 'winston';
import { config } from '../config/index.js';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: config.logging.level,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (config.logging.file) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      level: config.logging.level,
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  defaultMeta: { service: 'github-code-optimizer' },
});

// Add method for logging analysis events
export const logAnalysisEvent = (event: string, data: any) => {
  logger.info('Analysis Event', { event, ...data });
};

export const logOptimizationFound = (repo: string, optimization: any) => {
  logger.info('Optimization Found', {
    repository: repo,
    type: optimization.type,
    severity: optimization.severity,
    estimatedGain: optimization.estimatedGain,
  });
};

export const logPREvent = (repo: string, prNumber: number, status: string) => {
  logger.info('PR Event', {
    repository: repo,
    prNumber,
    status,
  });
};