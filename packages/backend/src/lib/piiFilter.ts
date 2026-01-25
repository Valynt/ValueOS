
import { redactSensitiveData } from './redaction';

export function sanitizeForLogging(data: any): any {
  return redactSensitiveData(data);
}
