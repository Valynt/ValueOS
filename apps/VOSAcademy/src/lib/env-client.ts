/**
 * Client-side environment variable validation
 * These are exposed to the browser via Vite's VITE_ prefix
 */

const REQUIRED_CLIENT_ENV_VARS = [
  'VITE_OAUTH_PORTAL_URL',
  'VITE_APP_ID',
] as const;

/**
 * Validate client-side environment variables
 */
function validateClientEnv() {
  const missing: string[] = [];

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

  console.log('[ENV] Client environment validation passed');
  return true;
}

// Validate on module load
const isValid = validateClientEnv();

export const CLIENT_ENV = {
  oauthPortalUrl: import.meta.env.VITE_OAUTH_PORTAL_URL || '',
  appId: import.meta.env.VITE_APP_ID || '',
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
