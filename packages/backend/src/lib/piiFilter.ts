
import { redactSensitiveData } from './redaction.js'

export function sanitizeForLogging(data: any): any {
  return redactSensitiveData(data);
}
