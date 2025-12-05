/**
 * Centralized Logging System
 * 
 * Provides structured logging with multiple transports (console, CloudWatch, file).
 * Includes context tracking, log levels, and automatic PII filtering.
 */

import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

// Log context interface
export interface LogContext {
  userId?: string;
  sessionId?: string;
  traceId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

// PII patterns to filter
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // Credit card
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, // Bearer tokens
  /api[_-]?key["\s:=]+[A-Za-z0-9\-._~+\/]+=*/gi, // API keys
];

/**
 * Filter PII from log messages
 */
function filterPII(message: string): string {
  let filtered = message;
  
  for (const pattern of PII_PATTERNS) {
    filtered = filtered.replace(pattern, '[REDACTED]');
  }
  
  return filtered;
}

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Filter PII from message
    const filteredMessage = typeof message === 'string' ? filterPII(message) : message;
    
    // Build log entry
    const logEntry: any = {
      timestamp,
      level,
      message: filteredMessage,
      environment: process.env.NODE_ENV || 'development',
      service: 'valuecanvas-api',
      version: process.env.APP_VERSION || '1.0.0'
    };
    
    // Add metadata
    if (Object.keys(meta).length > 0) {
      logEntry.meta = meta;
    }
    
    return JSON.stringify(logEntry);
  })
);

/**
 * Create Winston logger instance
 */
function createLogger(): winston.Logger {
  const transports: winston.transport[] = [];
  
  // Console transport (always enabled)
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
  
  // CloudWatch transport (production only)
  if (process.env.NODE_ENV === 'production' && process.env.AWS_REGION) {
    transports.push(
      new CloudWatchTransport({
        logGroupName: '/aws/eks/valuecanvas-production',
        logStreamName: `api-${new Date().toISOString().split('T')[0]}`,
        awsRegion: process.env.AWS_REGION,
        messageFormatter: ({ level, message, meta }) => {
          return JSON.stringify({
            level,
            message,
            ...meta
          });
        }
      })
    );
  }
  
  // File transport (development only)
  if (process.env.NODE_ENV === 'development') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 5
      })
    );
  }
  
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    exitOnError: false
  });
}

// Create logger instance
const winstonLogger = createLogger();

/**
 * Logger class with context support
 */
export class Logger {
  private context: LogContext = {};
  
  constructor(initialContext?: LogContext) {
    if (initialContext) {
      this.context = { ...initialContext };
    }
  }
  
  /**
   * Add context to logger
   */
  withContext(context: LogContext): Logger {
    const newLogger = new Logger(this.context);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }
  
  /**
   * Log error
   */
  error(message: string, error?: Error, meta?: any): void {
    winstonLogger.error(message, {
      ...this.context,
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
  
  /**
   * Log warning
   */
  warn(message: string, meta?: any): void {
    winstonLogger.warn(message, {
      ...this.context,
      ...meta
    });
  }
  
  /**
   * Log info
   */
  info(message: string, meta?: any): void {
    winstonLogger.info(message, {
      ...this.context,
      ...meta
    });
  }
  
  /**
   * Log HTTP request
   */
  http(message: string, meta?: any): void {
    winstonLogger.http(message, {
      ...this.context,
      ...meta
    });
  }
  
  /**
   * Log debug
   */
  debug(message: string, meta?: any): void {
    winstonLogger.debug(message, {
      ...this.context,
      ...meta
    });
  }
  
  /**
   * Log LLM API call
   */
  llm(operation: string, meta: {
    provider: 'together_ai' | 'openai';
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    cost?: number;
    latency?: number;
    success: boolean;
    error?: string;
  }): void {
    this.info(`LLM API call: ${operation}`, {
      category: 'llm',
      ...meta
    });
  }
  
  /**
   * Log database query
   */
  database(operation: string, meta: {
    table?: string;
    duration?: number;
    rowCount?: number;
    error?: string;
  }): void {
    this.debug(`Database operation: ${operation}`, {
      category: 'database',
      ...meta
    });
  }
  
  /**
   * Log cache operation
   */
  cache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, meta?: any): void {
    this.debug(`Cache ${operation}: ${key}`, {
      category: 'cache',
      ...meta
    });
  }
}

// Export default logger instance
export const logger = new Logger();

/**
 * Express middleware for request logging
 */
export function requestLogger(req: any, res: any, next: any): void {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Create logger with request context
  req.logger = new Logger({
    requestId,
    method: req.method,
    endpoint: req.path,
    userId: req.user?.id,
    ip: req.ip
  });
  
  // Log request
  req.logger.http('Incoming request', {
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    },
    query: req.query,
    body: req.body ? '[PRESENT]' : undefined
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    req.logger.http('Request completed', {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    });
  });
  
  next();
}

/**
 * Error logging middleware
 */
export function errorLogger(err: Error, req: any, res: any, next: any): void {
  const logger = req.logger || new Logger();
  
  logger.error('Request error', err, {
    statusCode: res.statusCode,
    endpoint: req.path,
    method: req.method
  });
  
  next(err);
}
