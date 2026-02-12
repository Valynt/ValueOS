/* eslint-disable no-console */
// Structured logger stub for browser/service contexts.
// This file is the ONLY place where console.log is permitted (via eslint-disable).
// All other production code must import { logger } from this module.
// In production, replace this stub with a transport-backed logger (e.g. Winston, Pino).

export const logger = {
  info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data !== undefined ? data : ""),
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data !== undefined ? data : ""),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data !== undefined ? data : ""),
  debug: (msg: string, data?: unknown) => console.log(`[DEBUG] ${msg}`, data !== undefined ? data : ""),
};

export const createLogger = () => logger;

export const log = logger;
