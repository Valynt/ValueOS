
import { redactSensitiveData } from './redaction.js'

export function sanitizeForLogging(data: unknown): unknown {
  return redactSensitiveData(data);
}
