import { redactSensitiveData } from "./redaction.js";

export function sanitizeStructuredLog<T>(payload: T): T {
  return redactSensitiveData(payload);
}

export function serializeErrorForLogging(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return sanitizeStructuredLog({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  return sanitizeStructuredLog({ error: String(error) });
}

export function sanitizeErrorEnvelope<T>(envelope: T): T {
  return sanitizeStructuredLog(envelope);
}
