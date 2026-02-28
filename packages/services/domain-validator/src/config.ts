/**
 * Configuration for Domain Validator Service
 */

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase configuration
    supabase: {
      url: process.env.SUPABASE_URL || '',
      // serviceRoleKey must only be used for AuthService, tenant provisioning, or cron jobs
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },

  // Cache configuration
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10), // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  // Enforce service_role usage policy
  // Only allow service_role in AuthService, tenant provisioning, or cron jobs
  // Any other use is forbidden and must throw an error or be blocked in implementation

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
