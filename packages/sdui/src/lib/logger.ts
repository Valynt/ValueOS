// Simple logger stub for SDUI package
export const logger = {
  info: (message: string, context?: any) => console.info(message, context),
  warn: (message: string, context?: any) => console.warn(message, context),
  error: (message: string, error?: Error, context?: any) => console.error(message, error, context),
};
