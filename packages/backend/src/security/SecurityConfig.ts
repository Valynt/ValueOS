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
    csrfEnabled: process.env.CSRF_ENABLED !== "false",
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:5173"],
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

export interface SessionTimeoutConfig {
  idleTimeout: number;
  absoluteTimeout: number;
  warningThreshold: number;
  renewalThreshold: number;
}

export function getSessionTimeoutForRole(role: string): SessionTimeoutConfig {
  const config = getSecurityConfig();

  // Role-based timeout values in milliseconds
  const timeouts: Record<string, { idle: number; absolute: number }> = {
    admin: { idle: 15 * 60 * 1000, absolute: 30 * 60 * 1000 }, // 15min idle, 30min absolute
    user: { idle: 60 * 60 * 1000, absolute: 24 * 60 * 60 * 1000 }, // 60min idle, 24hr absolute
    member: { idle: 30 * 60 * 1000, absolute: 60 * 60 * 1000 }, // 30min idle, 60min absolute
    super_admin: { idle: 15 * 60 * 1000, absolute: 30 * 60 * 1000 }, // 15min idle, 30min absolute
    guest: { idle: 10 * 60 * 1000, absolute: 30 * 60 * 1000 }, // 10min idle, 30min absolute
    manager: { idle: 20 * 60 * 1000, absolute: 40 * 60 * 1000 }, // 20min idle, 40min absolute (<= member)
  };

  const roleTimeouts = timeouts[role] ?? timeouts.member;

  // Warning at 10% of remaining time, renewal at 5%
  const timeUntilExpiry = Math.min(roleTimeouts.idle, roleTimeouts.absolute);

  return {
    idleTimeout: roleTimeouts.idle,
    absoluteTimeout: roleTimeouts.absolute,
    warningThreshold: timeUntilExpiry * 0.1, // 10% before expiry
    renewalThreshold: timeUntilExpiry * 0.05, // 5% before expiry
  };
}
