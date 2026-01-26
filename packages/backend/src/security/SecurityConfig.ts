/**
 * Security Configuration
 */

export interface SecurityConfig {
  csrfEnabled: boolean;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  sessionTimeout: {
    default: number;
    admin: number;
    user: number;
  };
}

export function getSecurityConfig(): SecurityConfig {
  return {
    csrfEnabled: process.env.CSRF_ENABLED !== 'false',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'],
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
    sessionTimeout: {
      default: 24 * 60 * 60 * 1000, // 24 hours
      admin: 8 * 60 * 60 * 1000, // 8 hours
      user: 24 * 60 * 60 * 1000, // 24 hours
    },
  };
}

export function getSessionTimeoutForRole(role: string): number {
  const config = getSecurityConfig();
  switch (role) {
    case 'admin':
      return config.sessionTimeout.admin;
    case 'user':
      return config.sessionTimeout.user;
    default:
      return config.sessionTimeout.default;
  }
}