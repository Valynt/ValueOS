// Minimal SecurityLogger — provides structured security event logging.
// Callers use securityLogger.log({ category, action, metadata }).
import { logger } from "../../lib/logger.js";

interface SecurityLogEntry {
  category: string;
  action: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  tenantId?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

class SecurityLogger {
  log(entry: SecurityLogEntry): void {
    logger.warn({ security: true, ...entry }, `[security] ${entry.category}:${entry.action}`);
  }

  warn(entry: SecurityLogEntry): void {
    this.log({ ...entry, severity: entry.severity ?? "medium" });
  }

  error(entry: SecurityLogEntry): void {
    this.log({ ...entry, severity: entry.severity ?? "high" });
  }
}

export const securityLogger = new SecurityLogger();
export { SecurityLogger };
