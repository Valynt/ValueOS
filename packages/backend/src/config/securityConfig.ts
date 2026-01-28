/**
 * OWASP Security Hardening Configuration
 * Comprehensive security headers, policies, and configurations
 */

import { Request, Response } from 'express';

// Security Headers Configuration
export interface SecurityHeadersConfig {
  // Content Security Policy
  csp: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
    workerSrc: string[];
    frameAncestors: string[];
    baseUri: string[];
    formAction: string[];
    upgradeInsecureRequests: boolean;
    reportUri: string;
  };

  // Other Security Headers
  hsts: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };

  xFrameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';

  xContentTypeOptions: 'nosniff';

  xXssProtection: {
    enabled: boolean;
    mode: 'block' | 'report';
  };

  referrerPolicy: 'strict-origin-when-cross-origin' | 'no-referrer' | 'strict-origin' | string;

  permissionsPolicy: Record<string, string[]>;

  dnsPrefetchControl: 'on' | 'off';

  // CORS Configuration
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
    maxAge: number;
  };

  // Session/Cookie Configuration
  session: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    domain?: string;
    path: string;
  };

  // CSRF Configuration
  csrf: {
    enabled: boolean;
    cookieName: string;
    headerName: string;
    tokenLength: number;
    secretLength: number;
  };

  // File Upload Configuration
  fileUpload: {
    maxFileSize: number; // bytes
    maxFiles: number;
    allowedTypes: string[];
    rateLimit: {
      windowMs: number;
      maxUploads: number;
    };
  };

  // SSRF Protection
  ssrf: {
    enabled: boolean;
    allowedHosts: string[];
    blockedHosts: string[];
    allowedPorts: number[];
    timeout: number;
  };
}

// Production Security Configuration
export const productionSecurityConfig: SecurityHeadersConfig = {
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'strict-dynamic'"],
    styleSrc: ["'self'", "'strict-dynamic'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.supabase.co", "https://*.supabase.co"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    workerSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: true,
    reportUri: "/api/security/csp-report",
  },

  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  xFrameOptions: 'DENY',

  xContentTypeOptions: 'nosniff',

  xXssProtection: {
    enabled: true,
    mode: 'block',
  },

  referrerPolicy: 'strict-origin-when-cross-origin',

  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    interestCohort: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: [],
    payment: [],
    usb: [],
  },

  dnsPrefetchControl: 'off',

  cors: {
    origins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  session: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  },

  csrf: {
    enabled: true,
    cookieName: 'csrf_token',
    headerName: 'x-csrf-token',
    tokenLength: 32,
    secretLength: 64,
  },

  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxUploads: 10,
    },
  },

  ssrf: {
    enabled: true,
    allowedHosts: ['api.supabase.co', '*.supabase.co', 'api.openai.com'],
    blockedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'],
    allowedPorts: [80, 443, 3000, 8000, 5432],
    timeout: 10000, // 10 seconds
  },
};

// Development Security Configuration (relaxed)
export const developmentSecurityConfig: SecurityHeadersConfig = {
  ...productionSecurityConfig,
  csp: {
    ...productionSecurityConfig.csp,
    scriptSrc: ["'self'", "'unsafe-eval'"], // Required for HMR
    styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind HMR
    connectSrc: [
      "'self'",
      "ws://localhost:*",
      "http://localhost:*",
      "https://api.supabase.co",
      "https://*.supabase.co",
    ],
  },
  session: {
    ...productionSecurityConfig.session,
    secure: false, // Allow HTTP in development
    sameSite: 'lax',
  },
  cors: {
    ...productionSecurityConfig.cors,
    origins: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  },
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityHeadersConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? productionSecurityConfig : developmentSecurityConfig;
}

/**
 * Apply comprehensive security headers to response
 */
export function applySecurityHeaders(req: Request, res: Response): void {
  const config = getSecurityConfig();

  // Content Security Policy
  const cspDirectives = [
    `default-src ${config.csp.defaultSrc.join(' ')}`,
    `script-src ${config.csp.scriptSrc.join(' ')}`,
    `style-src ${config.csp.styleSrc.join(' ')}`,
    `img-src ${config.csp.imgSrc.join(' ')}`,
    `connect-src ${config.csp.connectSrc.join(' ')}`,
    `font-src ${config.csp.fontSrc.join(' ')}`,
    `object-src ${config.csp.objectSrc.join(' ')}`,
    `media-src ${config.csp.mediaSrc.join(' ')}`,
    `frame-src ${config.csp.frameSrc.join(' ')}`,
    `worker-src ${config.csp.workerSrc.join(' ')}`,
    `frame-ancestors ${config.csp.frameAncestors.join(' ')}`,
    `base-uri ${config.csp.baseUri.join(' ')}`,
    `form-action ${config.csp.formAction.join(' ')}`,
    config.csp.upgradeInsecureRequests ? 'upgrade-insecure-requests' : '',
    `report-uri ${config.csp.reportUri}`,
  ].filter(Boolean);

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // HSTS
  const hstsValue = `max-age=${config.hsts.maxAge}${
    config.hsts.includeSubDomains ? '; includeSubDomains' : ''
  }${config.hsts.preload ? '; preload' : ''}`;
  res.setHeader('Strict-Transport-Security', hstsValue);

  // X-Frame-Options
  res.setHeader('X-Frame-Options', config.xFrameOptions);

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);

  // X-XSS-Protection
  const xssValue = `1; mode=${config.xXssProtection.mode}`;
  res.setHeader('X-XSS-Protection', xssValue);

  // Referrer-Policy
  res.setHeader('Referrer-Policy', config.referrerPolicy);

  // Permissions-Policy
  const permissions = Object.entries(config.permissionsPolicy)
    .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
    .join(', ');
  res.setHeader('Permissions-Policy', permissions);

  // X-DNS-Prefetch-Control
  res.setHeader('X-DNS-Prefetch-Control', config.dnsPrefetchControl);

  // Additional security headers
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

/**
 * Validate file upload against security constraints
 */
export function validateFileUpload(
  file: Express.Multer.File,
  config: SecurityHeadersConfig['fileUpload'] = getSecurityConfig().fileUpload
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File size ${file.size} exceeds maximum allowed size ${config.maxFileSize}`,
    };
  }

  // Check file type
  if (!config.allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`,
    };
  }

  // Additional security checks can be added here
  // - File signature validation
  // - Malware scanning
  // - Content analysis

  return { valid: true };
}

/**
 * Generate secure CSRF token
 */
export function generateCSRFToken(config: SecurityHeadersConfig['csrf'] = getSecurityConfig().csrf): string {
  const crypto = await import('crypto');
  return crypto.randomBytes(config.tokenLength).toString('hex');
}

/**
 * Validate URL against SSRF protection rules
 */
export function validateSSRFUrl(
  url: string,
  config: SecurityHeadersConfig['ssrf'] = getSecurityConfig().ssrf
): { valid: boolean; error?: string } {
  if (!config.enabled) {
    return { valid: true };
  }

  try {
    const parsedUrl = new URL(url);

    // Check blocked hosts
    if (config.blockedHosts.some(host =>
      parsedUrl.hostname === host ||
      parsedUrl.hostname.endsWith('.' + host) ||
      host.includes('*') && parsedUrl.hostname.includes(host.replace('*', ''))
    )) {
      return { valid: false, error: 'URL blocked by SSRF protection' };
    }

    // Check allowed hosts (if whitelist is enabled)
    if (config.allowedHosts.length > 0) {
      const isAllowed = config.allowedHosts.some(host =>
        parsedUrl.hostname === host ||
        parsedUrl.hostname.endsWith('.' + host) ||
        host.includes('*') && parsedUrl.hostname.includes(host.replace('*', ''))
      );

      if (!isAllowed) {
        return { valid: false, error: 'URL not in allowed hosts list' };
      }
    }

    // Check port
    const port = parsedUrl.port ? parseInt(parsedUrl.port) :
      (parsedUrl.protocol === 'https:' ? 443 : 80);

    if (!config.allowedPorts.includes(port)) {
      return { valid: false, error: `Port ${port} not allowed` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}