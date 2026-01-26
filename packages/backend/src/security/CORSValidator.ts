/**
 * CORS Validator
 */

import { getSecurityConfig } from './SecurityConfig.js'

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  const config = getSecurityConfig();
  return config.corsOrigins.includes(origin);
}

export function getCORSHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
  }

  return headers;
}