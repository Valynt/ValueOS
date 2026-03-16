/**
 * OWASP Security Configuration
 * Centralized security settings for the application
 */

export interface SecurityConfig {
  headers: {
    csp: {
      enabled: boolean;
      reportUri: string;
      productionNonce: boolean;
    };
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    xFrameOptions: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
    xContentTypeOptions: boolean;
    xXssProtection: boolean;
    referrerPolicy: string;
    permissionsPolicy: string;
    crossOriginEmbedderPolicy: "require-corp" | "credentialless" | "unsafe-none";
    crossOriginOpenerPolicy: "same-origin" | "same-origin-allow-popups" | "unsafe-none";
    crossOriginResourcePolicy: "same-origin" | "same-site" | "cross-origin";
  };
  csrf: {
    enabled: boolean;
    tokenName: string;
    headerName: string;
    cookieName: string;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  };
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
    maxAge: number;
  };
  fileUpload: {
    enabled: boolean;
    maxFileSize: number;
    maxFilesPerRequest: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    scanForMalware: boolean;
  };
  ssrf: {
    enabled: boolean;
    blockedHosts: string[];
    blockedIpRanges: string[];
    allowedPorts: number[];
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
}

export const securityConfig: SecurityConfig = {
  headers: {
    csp: {
      enabled: true,
      reportUri: "/api/csp-report",
      productionNonce: true,
    },
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    xFrameOptions: "DENY",
    xContentTypeOptions: true,
    xXssProtection: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=()",
    crossOriginEmbedderPolicy: "require-corp",
    crossOriginOpenerPolicy: "same-origin",
    crossOriginResourcePolicy: "same-origin",
  },
  csrf: {
    enabled: true,
    tokenName: "csrf_token",
    headerName: "x-csrf-token",
    cookieName: "csrf_token",
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
  },
  cors: {
    enabled: true,
    origins: process.env.CORS_ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  fileUpload: {
    enabled: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerRequest: 5,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/json",
      "application/xml",
      "text/xml",
    ],
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".pdf",
      ".txt",
      ".csv",
      ".json",
      ".xml",
    ],
    scanForMalware: false, // Enable if malware scanning service is available
  },
  ssrf: {
    enabled: true,
    blockedHosts: ["localhost", "127.0.0.1", "::1"],
    blockedIpRanges: [
      "127.0.0.0/8",
      "192.168.0.0/16",
      "10.0.0.0/8",
      "172.16.0.0/12",
      "fc00::/7",
      "fe80::/10",
    ],
    allowedPorts: [80, 443, 3000, 3001, 8000, 5432],
  },
  rateLimiting: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
};

/**
 * Environment-specific overrides
 */
export function getSecurityConfig(): SecurityConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    ...securityConfig,
    headers: {
      ...securityConfig.headers,
      crossOriginEmbedderPolicy: isDevelopment
        ? "unsafe-none"
        : securityConfig.headers.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: isDevelopment
        ? "unsafe-none"
        : securityConfig.headers.crossOriginOpenerPolicy,
    },
    csrf: {
      ...securityConfig.csrf,
      secure: isProduction,
      sameSite: isProduction ? "Strict" : "Lax",
    },
  };
}
