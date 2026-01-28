// Simple logger stub for SDUI package
export const logger = {
  info: (message: string, context?: any) => console.info(message, context),
  warn: (message: string, context?: any) => console.warn(message, context),
  error: (message: string, error?: Error, context?: any) => console.error(message, error, context),
};

export const createLogger = (config: { component: string }) => ({
  info: (message: string, context?: any) => console.info(`[${config.component}] ${message}`, context),
  warn: (message: string, context?: any) => console.warn(`[${config.component}] ${message}`, context),
  error: (message: string, error?: Error, context?: any) => console.error(`[${config.component}] ${message}`, error, context),
});
