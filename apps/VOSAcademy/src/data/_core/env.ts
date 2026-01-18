/**
 * Required environment variables for server-side operations
 */
if (typeof window !== 'undefined') {
  throw new Error('[ENV] Security risk: Server environment module loaded in browser context. This could expose server secrets. Use env-client.ts for browser environment variables which should be prefixed with VITE_.');
}
}

const REQUIRED_SERVER_ENV_VARS = [
  'DATABASE_URL',
] as const;

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_SERVER_ENV_VARS = [
  'OWNER_OPENID',
  'NODE_ENV',
  'SESSION_JWT_KEYS',
  'SESSION_JWT_ISSUER',
  'SESSION_JWT_AUDIENCE',
  'SESSION_JWT_TTL_SECONDS',
  'SESSION_JWT_TENANT',
] as const;

/**
 * Validate environment variables on startup
 */
function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of REQUIRED_SERVER_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional variables
  for (const key of OPTIONAL_SERVER_ENV_VARS) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    const error = `[ENV] Missing required environment variables: ${missing.join(', ')}`;
    console.error(error);
    console.error('[ENV] Please check your .env.local file or environment configuration');
    throw new Error(error);
  }

  if (warnings.length > 0) {
    console.warn(`[ENV] Missing optional environment variables: ${warnings.join(', ')}`);
    console.warn('[ENV] Some features may not work correctly');
  }

  console.log('[ENV] Environment validation passed');
}

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    // In development, log but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.error('[ENV] Validation failed, but continuing in development mode');
    } else {
      // In production, this should crash the app
      throw error;
    }
  }
}

export const ENV = {
  ownerOpenId: process.env.OWNER_OPENID || "",
  databaseUrl: process.env.DATABASE_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",
  oauthPortalUrl: process.env.VITE_OAUTH_PORTAL_URL || "",
  appId: process.env.VITE_APP_ID || "",
  sessionJwtIssuer: process.env.SESSION_JWT_ISSUER || "",
  appId: process.env.VITE_APP_ID || "",
  sessionJwtIssuer: process.env.SESSION_JWT_ISSUER || "",
  sessionJwtAudience: process.env.SESSION_JWT_AUDIENCE || "",
  sessionJwtKeys: process.env.SESSION_JWT_KEYS || "",
  sessionJwtTtlSeconds: process.env.SESSION_JWT_TTL_SECONDS || "",
  sessionJwtTenant: process.env.SESSION_JWT_TENANT || "",

/**
 * Check if all required environment variables are configured
 */
export function isEnvConfigured(): boolean {
  return REQUIRED_SERVER_ENV_VARS.every(key => !!process.env[key]);
}
