/**
 * Input Sanitizer
 */

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove null bytes and control characters
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim();
}

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj !== 'object') return obj;

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    const sanitizedValue = sanitizeObject(value);
    if (Array.isArray(sanitized)) {
      sanitized.push(sanitizedValue);
    } else {
      sanitized[sanitizedKey] = sanitizedValue;
    }
  }

  return sanitized;
}

export function sanitizeInput(input: any): any {
  return sanitizeObject(input);
}