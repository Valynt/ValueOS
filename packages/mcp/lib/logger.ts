/**
 * MCP Logger - Stub implementation
 * TODO: Replace with structured logging library (pino, winston)
 */

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

const createLogger = (name: string): Logger => ({
  info: (message: string, context?: LogContext) => {
    console.info(`[${name}] ${message}`, context || "");
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(`[${name}] ${message}`, context || "");
  },
  error: (message: string, context?: LogContext) => {
    console.error(`[${name}] ${message}`, context || "");
  },
  debug: (message: string, context?: LogContext) => {
    if (process.env.DEBUG) {
      console.debug(`[${name}] ${message}`, context || "");
    }
  },
});

export const logger = createLogger("mcp");
export default logger;
