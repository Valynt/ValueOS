 
// Structured logger stub for browser/service contexts.
// This file is the ONLY place where console.log is permitted (via eslint-disable).
// All other production code must import { logger } from this module.
// In production, replace this stub with a transport-backed logger (e.g. Winston, Pino).

export const logger = {
  // eslint-disable-next-line no-console -- logging utility / bootstrap code
  info: (msg: string, ...data: unknown[]) => console.log(`[INFO] ${msg}`, ...data),
  warn: (msg: string, ...data: unknown[]) => console.warn(`[WARN] ${msg}`, ...data),
  error: (msg: string, ...data: unknown[]) => console.error(`[ERROR] ${msg}`, ...data),
  // eslint-disable-next-line no-console -- logging utility / bootstrap code
  debug: (msg: string, ...data: unknown[]) => console.log(`[DEBUG] ${msg}`, ...data),
};

export const createLogger = (_context?: string) => logger;

export const log = logger;

/** Monitoring setup stub - replace with real implementation in production */
export function setupMonitoring(): void {
  // Stub: monitoring initialization placeholder
}
