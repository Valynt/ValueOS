/**
 * Structured JSON Logger
 * 
 * Production-grade logging with correlation IDs and safe metadata.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * Sanitize sensitive data from log entries
 */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(k => lowerKey.includes(k))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(meta || {}),
  };
}

/**
 * Output log entry
 */
function output(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  
  if (entry.level === 'error') {
    console.error(json);
  } else if (entry.level === 'warn') {
    console.warn(json);
  } else {
    console.log(json);
  }
}

/**
 * Logger instance
 */
export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      output(createEntry('debug', message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    output(createEntry('info', message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    output(createEntry('warn', message, meta));
  },

  error(message: string, meta?: Record<string, unknown>): void {
    output(createEntry('error', message, meta));
  },
};

export default logger;
