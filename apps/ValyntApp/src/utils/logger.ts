/**
 * Browser-safe logger stub.
 * The full server-side logger (winston/CloudWatch) lives in packages/backend.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

class Logger {
  debug(message: string, context?: LogContext): void {
     
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.debug("[DEBUG]", message, context);
  }
  info(message: string, context?: LogContext): void {
     
    // eslint-disable-next-line no-console
    console.info("[INFO]", message, context);
  }
  warn(message: string, context?: LogContext): void {
    console.warn("[WARN]", message, context);
  }
  error(message: string, context?: LogContext): void {
    console.error("[ERROR]", message, context);
  }
}

export const logger = new Logger();
export default logger;
