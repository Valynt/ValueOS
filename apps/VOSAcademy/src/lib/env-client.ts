/**
 * Client-side environment variable validation
 * These are exposed to the browser via Vite's VITE_ prefix
 */

import { logger } from './logger';

const REQUIRED_CLIENT_PREFIX = 'VITE_';

const REQUIRED_CLIENT_ENV_VARS = [
  'VITE_OAUTH_PORTAL_URL',
  'VITE_APP_ID',
] as const;

const ALLOWED_NON_VITE_KEYS = new Set([
  'BASE_URL',
  'MODE',
  'DEV',
  'PROD',
  'SSR',
]);

/**
 * Validate client-side environment variables
 */
function validateClientEnv() {
  const missing: string[] = [];
  const nonViteKeys = Object.keys(import.meta.env).filter(
    (key) => !key.startsWith('VITE_') && !ALLOWED_NON_VITE_KEYS.has(key),
  );

  if (nonViteKeys.length > 0) {
    console.error(
      `[ENV] Non-VITE environment variables detected in client bundle: ${nonViteKeys.join(', ')}`,
    );
    console.error('[ENV] Client code must only consume variables prefixed with VITE_.');
    return false;
  }

  for (const key of REQUIRED_CLIENT_ENV_VARS) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const error = `Missing required client environment variables: ${missing.join(', ')}`;
    console.error('[ENV]', error);
    console.error('[ENV] Please check your .env.local file');
    
    // Show user-friendly error in development
    if (import.meta.env.DEV) {
      console.error('[ENV] Add these to your .env.local file:');
      missing.forEach(key => {
        console.error(`${key}=your_value_here`);
      });
    }
    
    return false;
  }

  logger.info("Client environment validation passed");
  return true;
}

function getClientEnvValue(key: string): string {
  if (!key.startsWith(REQUIRED_CLIENT_PREFIX)) {
    throw new Error(
      `[ENV] Attempted to access non-${REQUIRED_CLIENT_PREFIX} env key in client code: ${key}`,
    );
  }

  return import.meta.env[key] || '';
}

// Validate on module load
const isValid = validateClientEnv();

export const CLIENT_ENV = {
  oauthPortalUrl: getClientEnvValue('VITE_OAUTH_PORTAL_URL'),
  appId: getClientEnvValue('VITE_APP_ID'),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  isValid,
};

/**
 * Check if client environment is properly configured
 */
export function isClientEnvConfigured(): boolean {
  return isValid;
}
