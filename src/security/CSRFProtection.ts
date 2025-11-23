/**
 * CSRF Protection
 * 
 * Implements Cross-Site Request Forgery protection using the Synchronizer Token Pattern.
 * Generates and validates CSRF tokens for state-changing operations.
 */

import { logger } from '../lib/logger';
import { getSecurityConfig } from './SecurityConfig';

/**
 * CSRF token configuration
 */
export interface CSRFTokenConfig {
  tokenLength: number;
  tokenLifetime: number; // milliseconds
  headerName: string;
  cookieName: string;
  paramName: string;
}

/**
 * CSRF token
 */
export interface CSRFToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Default CSRF configuration
 */
const DEFAULT_CSRF_CONFIG: CSRFTokenConfig = {
  tokenLength: 32,
  tokenLifetime: 3600000, // 1 hour
  headerName: 'X-CSRF-Token',
  cookieName: 'csrf_token',
  paramName: '_csrf',
};

/**
 * CSRF token storage
 */
class CSRFTokenStore {
  private tokens: Map<string, CSRFToken> = new Map();

  /**
   * Store a token
   */
  set(key: string, token: CSRFToken): void {
    this.tokens.set(key, token);
    this.cleanup();
  }

  /**
   * Get a token
   */
  get(key: string): CSRFToken | undefined {
    const token = this.tokens.get(key);
    if (token && token.expiresAt > Date.now()) {
      return token;
    }
    if (token) {
      this.tokens.delete(key);
    }
    return undefined;
  }

  /**
   * Delete a token
   */
  delete(key: string): void {
    this.tokens.delete(key);
  }

  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, token] of this.tokens.entries()) {
      if (token.expiresAt <= now) {
        this.tokens.delete(key);
      }
    }
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    this.tokens.clear();
  }
}

/**
 * Global token store
 */
const tokenStore = new CSRFTokenStore();

/**
 * Generate a random token
 */
function generateRandomToken(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(
  sessionId?: string,
  config: Partial<CSRFTokenConfig> = {}
): CSRFToken {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const token = generateRandomToken(cfg.tokenLength);
  const createdAt = Date.now();
  const expiresAt = createdAt + cfg.tokenLifetime;

  const csrfToken: CSRFToken = {
    token,
    createdAt,
    expiresAt,
  };

  // Store token
  const key = sessionId || 'default';
  tokenStore.set(key, csrfToken);

  return csrfToken;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(
  token: string,
  sessionId?: string,
  config: Partial<CSRFTokenConfig> = {}
): boolean {
  if (!token) {
    return false;
  }

  const key = sessionId || 'default';
  const storedToken = tokenStore.get(key);

  if (!storedToken) {
    return false;
  }

  // Check if token matches
  if (storedToken.token !== token) {
    return false;
  }

  // Check if token is expired
  if (storedToken.expiresAt <= Date.now()) {
    tokenStore.delete(key);
    return false;
  }

  return true;
}

/**
 * Refresh a CSRF token
 */
export function refreshCSRFToken(
  sessionId?: string,
  config: Partial<CSRFTokenConfig> = {}
): CSRFToken {
  const key = sessionId || 'default';
  tokenStore.delete(key);
  return generateCSRFToken(sessionId, config);
}

/**
 * Get current CSRF token
 */
export function getCSRFToken(sessionId?: string): CSRFToken | undefined {
  const key = sessionId || 'default';
  return tokenStore.get(key);
}

/**
 * Delete CSRF token
 */
export function deleteCSRFToken(sessionId?: string): void {
  const key = sessionId || 'default';
  tokenStore.delete(key);
}

/**
 * Clear all CSRF tokens
 */
export function clearAllCSRFTokens(): void {
  tokenStore.clear();
}

/**
 * Set CSRF token in cookie
 */
export function setCSRFCookie(
  token: string,
  config: Partial<CSRFTokenConfig> = {}
): void {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const securityConfig = getSecurityConfig();

  const cookieOptions = [
    `${cfg.cookieName}=${token}`,
    `Path=/`,
    `Max-Age=${cfg.tokenLifetime / 1000}`,
    `SameSite=${securityConfig.session.sameSite}`,
  ];

  if (securityConfig.session.secure) {
    cookieOptions.push('Secure');
  }

  if (securityConfig.session.httpOnly) {
    cookieOptions.push('HttpOnly');
  }

  document.cookie = cookieOptions.join('; ');
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFCookie(config: Partial<CSRFTokenConfig> = {}): string | null {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cfg.cookieName) {
      return value;
    }
  }

  return null;
}

/**
 * Delete CSRF cookie
 */
export function deleteCSRFCookie(config: Partial<CSRFTokenConfig> = {}): void {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  document.cookie = `${cfg.cookieName}=; Path=/; Max-Age=0`;
}

/**
 * Add CSRF token to request headers
 */
export function addCSRFHeader(
  headers: Headers | Record<string, string>,
  token?: string,
  config: Partial<CSRFTokenConfig> = {}
): Headers | Record<string, string> {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const csrfToken = token || getCSRFCookie(cfg);

  if (!csrfToken) {
    logger.warn('No CSRF token available');
    return headers;
  }

  if (headers instanceof Headers) {
    headers.set(cfg.headerName, csrfToken);
  } else {
    headers[cfg.headerName] = csrfToken;
  }

  return headers;
}

/**
 * Add CSRF token to form data
 */
export function addCSRFToFormData(
  formData: FormData,
  token?: string,
  config: Partial<CSRFTokenConfig> = {}
): FormData {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const csrfToken = token || getCSRFCookie(cfg);

  if (!csrfToken) {
    logger.warn('No CSRF token available');
    return formData;
  }

  formData.append(cfg.paramName, csrfToken);
  return formData;
}

/**
 * Add CSRF token to URL parameters
 */
export function addCSRFToURL(
  url: string,
  token?: string,
  config: Partial<CSRFTokenConfig> = {}
): string {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };
  const csrfToken = token || getCSRFCookie(cfg);

  if (!csrfToken) {
    logger.warn('No CSRF token available');
    return url;
  }

  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set(cfg.paramName, csrfToken);
  return urlObj.toString();
}

/**
 * Fetch wrapper with CSRF protection
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {},
  config: Partial<CSRFTokenConfig> = {}
): Promise<Response> {
  const cfg = { ...DEFAULT_CSRF_CONFIG, ...config };

  // Only add CSRF token for state-changing methods
  const method = (options.method || 'GET').toUpperCase();
  const requiresCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (requiresCSRF) {
    // Get or generate token
    let token = getCSRFCookie(cfg);
    if (!token) {
      const csrfToken = generateCSRFToken(undefined, cfg);
      token = csrfToken.token;
      setCSRFCookie(token, cfg);
    }

    // Add token to headers
    const headers = new Headers(options.headers);
    addCSRFHeader(headers, token, cfg);
    options.headers = headers;
  }

  return fetch(url, options);
}

/**
 * Initialize CSRF protection
 */
export function initializeCSRFProtection(
  sessionId?: string,
  config: Partial<CSRFTokenConfig> = {}
): CSRFToken {
  const securityConfig = getSecurityConfig();

  if (!securityConfig.security.csrfEnabled) {
    logger.warn('CSRF protection is disabled');
  }

  // Generate initial token
  const token = generateCSRFToken(sessionId, config);

  // Set cookie
  setCSRFCookie(token.token, config);

  // Add meta tag for easy access
  let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = 'csrf-token';
    document.head.appendChild(metaTag);
  }
  metaTag.content = token.token;

  return token;
}

/**
 * Get CSRF token from meta tag
 */
export function getCSRFTokenFromMeta(): string | null {
  const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
  return metaTag ? metaTag.content : null;
}

/**
 * React hook for CSRF protection
 */
export function useCSRFToken(sessionId?: string): {
  token: string | null;
  refresh: () => void;
  addToHeaders: (headers: Headers | Record<string, string>) => Headers | Record<string, string>;
  addToFormData: (formData: FormData) => FormData;
} {
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Get or generate token
    let csrfToken = getCSRFCookie();
    if (!csrfToken) {
      const generated = generateCSRFToken(sessionId);
      csrfToken = generated.token;
      setCSRFCookie(csrfToken);
    }
    setToken(csrfToken);
  }, [sessionId]);

  const refresh = React.useCallback(() => {
    const newToken = refreshCSRFToken(sessionId);
    setCSRFCookie(newToken.token);
    setToken(newToken.token);
  }, [sessionId]);

  const addToHeaders = React.useCallback((headers: Headers | Record<string, string>) => {
    return addCSRFHeader(headers, token || undefined);
  }, [token]);

  const addToFormData = React.useCallback((formData: FormData) => {
    return addCSRFToFormData(formData, token || undefined);
  }, [token]);

  return {
    token,
    refresh,
    addToHeaders,
    addToFormData,
  };
}

// Import React for the hook
import React from 'react';
