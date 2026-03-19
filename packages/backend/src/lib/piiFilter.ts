
import { redactSensitiveData } from './redaction.js'

export function sanitizeForLogging(data: unknown): unknown {
  return redactSensitiveData(data);
}

/** Alias for sanitizeForLogging — redacts PII from user/device objects. */
export const sanitizeUser = sanitizeForLogging;
