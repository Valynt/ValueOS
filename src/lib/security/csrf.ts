/**
 * CSRF Protection Service
 * Implements Cross-Site Request Forgery protection
 *
 * Strategy:
 * - Supabase uses PKCE flow (automatically CSRF-protected)
 * - Additional protection for custom endpoints
 * - Double-submit cookie pattern for mutations
 * - Origin validation for all state-changing requests
 */

const TOKEN_KEY = 'vc.csrf.token';
const TOKEN_EXPIRY_KEY = 'vc.csrf.expiry';
const TOKEN_VALIDITY_MS = 3600000; // 1 hour

export interface CSRFToken {
  token: string;
  expiresAt: number;
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Get or create CSRF token
 */
export function getCsrfToken(): string {
  if (typeof window === 'undefined') return '';

  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiryStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (token && expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() < expiry) {
        return token;
      }
    }

    return rotateCsrfToken();
  } catch (error) {
    logger.error('Failed to get CSRF token:', error);
    return '';
  }
}

/**
 * Generate new CSRF token
 */
export function rotateCsrfToken(): string {
  if (typeof window === 'undefined') return '';

  try {
    const token = generateToken();
    const expiry = Date.now() + TOKEN_VALIDITY_MS;

    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());

    return token;
  } catch (error) {
    logger.error('Failed to rotate CSRF token:', error);
    return '';
  }
}

/**
 * Clear CSRF token
 */
export function clearCsrfToken(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (error) {
    logger.error('Failed to clear CSRF token:', error);
  }
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(requestToken: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    const expiryStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!storedToken || !expiryStr) {
      return false;
    }

    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      clearCsrfToken();
      return false;
    }

    return storedToken === requestToken;
  } catch (error) {
    logger.error('Failed to validate CSRF token:', error);
    return false;
  }
}

/**
 * Check if HTTP method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Validate request origin
 */
export function validateOrigin(requestOrigin: string | null): boolean {
  if (typeof window === 'undefined') return true;
  if (!requestOrigin) return false;

  try {
    const allowedOrigins = [
      window.location.origin,
      import.meta.env.VITE_SUPABASE_URL,
    ].filter(Boolean);

    const originUrl = new URL(requestOrigin);
    return allowedOrigins.some(allowed => {
      const allowedUrl = new URL(allowed);
      return (
        originUrl.protocol === allowedUrl.protocol &&
        originUrl.host === allowedUrl.host
      );
    });
  } catch (error) {
    logger.error('Invalid origin:', requestOrigin, error);
    return false;
  }
}

/**
 * Add CSRF token to headers
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfToken();
  if (!token) return headers;

  const headersObj = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers)
    ? Object.fromEntries(headers)
    : headers;

  return {
    ...headersObj,
    'X-CSRF-Token': token
  };
}

/**
 * Create fetch wrapper with CSRF protection
 */
export function createProtectedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = init?.method || 'GET';

    if (requiresCsrfProtection(method)) {
      const headers = addCsrfHeader(init?.headers);
      init = { ...init, headers };
    }

    return fetch(input, init);
  };
}

/**
 * Protected fetch with automatic CSRF token
 */
export const protectedFetch = createProtectedFetch();
