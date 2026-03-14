// Simple logger stub for SDUI package
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => console.info(message, context),
  warn: (message: string, context?: Record<string, unknown>) => console.warn(message, context),
  error: (message: string, error?: Error, context?: Record<string, unknown>) => console.error(message, error, context),
};

export const createLogger = (config: { component: string }) => ({
  info: (message: string, context?: Record<string, unknown>) =>
    console.info(`[${config.component}] ${message}`, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    console.warn(`[${config.component}] ${message}`, context),
  error: (message: string, error?: Error, context?: Record<string, unknown>) =>
    console.error(`[${config.component}] ${message}`, error, context),
});