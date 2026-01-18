/**
 * Sentry Stub
 */
export const captureMessage = (message: string, context?: any) => {
  console.log(`[Sentry Stub] ${message}`, context);
};

export const captureException = (error: any, context?: any) => {
  console.error(`[Sentry Stub] Exception:`, error, context);
};
