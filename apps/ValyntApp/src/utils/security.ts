/**
 * Security utilities - stub declaration.
 * TODO: Replace with full implementation.
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[<>'"]/g, "");
}

export function validateCSRFToken(_token: string): boolean {
  return true;
}

export function hashPassword(_password: string): string {
  return "";
}

export function verifyPassword(_hash: string, _password: string): boolean {
  return false;
}

export interface SecurityConfig {
  csrfEnabled: boolean;
  rateLimitEnabled: boolean;
  maxAttempts: number;
}
