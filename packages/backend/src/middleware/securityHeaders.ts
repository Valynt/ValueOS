import { NextFunction, Request, Response } from "express";
import { securityEvents } from "../security/securityLogger.js"

export interface CSPConfig {
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
  reportUri?: string;
  frameAncestors?: string[];
  baseUri?: string[];
  formAction?: string[];
  upgradeInsecureRequests?: boolean;
}

// Production CSP - Strict, nonce-based
const productionCSP: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"], // Nonces added dynamically
  styleSrc: ["'self'"], // Nonces added dynamically
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: [
    "'self'",
    process.env.VITE_SUPABASE_URL || "",
    "https://api.openai.com",
    "https://api.together.xyz",
    "wss://*.supabase.co",
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  workerSrc: ["'self'", "blob:"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: true,
  reportUri: "/api/csp-report",
};

// Development CSP - Relaxed for HMR and debugging
const developmentCSP: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-eval'"], // Required for HMR
  styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind HMR
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: [
    "'self'",
    process.env.VITE_SUPABASE_URL || "",
    "ws://localhost:*",
    "http://localhost:*",
    "https://api.openai.com",
    "https://api.together.xyz",
    "wss://*.supabase.co",
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  workerSrc: ["'self'", "blob:"],
};

function buildCSPString(config: CSPConfig): string {
  const directives: string[] = [];

  directives.push(`default-src ${config.defaultSrc.join(" ")}`);
  directives.push(`script-src ${config.scriptSrc.join(" ")}`);
  directives.push(`style-src ${config.styleSrc.join(" ")}`);
  directives.push(`img-src ${config.imgSrc.join(" ")}`);
  directives.push(`connect-src ${config.connectSrc.join(" ")}`);
  directives.push(`font-src ${config.fontSrc.join(" ")}`);
  directives.push(`object-src ${config.objectSrc.join(" ")}`);
  directives.push(`media-src ${config.mediaSrc.join(" ")}`);
  directives.push(`frame-src ${config.frameSrc.join(" ")}`);
  directives.push(`worker-src ${config.workerSrc.join(" ")}`);

  if (config.frameAncestors) {
    directives.push(`frame-ancestors ${config.frameAncestors.join(" ")}`);
  }
  if (config.baseUri) {
    directives.push(`base-uri ${config.baseUri.join(" ")}`);
  }
  if (config.formAction) {
    directives.push(`form-action ${config.formAction.join(" ")}`);
  }
  if (config.upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Modern security headers middleware for production environments.
 * Implements CSP, HSTS, X-Frame-Options, NoSniff, and other protections.
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Select CSP based on environment
  const isDevelopment = process.env.NODE_ENV === "development";
  const baseCSP = isDevelopment ? developmentCSP : productionCSP;

  // Generate cryptographic nonce for CSP (only in production)
  let nonce: string | undefined;
  if (!isDevelopment) {
    nonce = crypto.randomBytes(16).toString('base64');
  }

  // Content Security Policy with nonce (production only)
  let cspConfig = baseCSP;
  if (nonce) {
    cspConfig = {
      ...baseCSP,
      scriptSrc: [...baseCSP.scriptSrc, `'nonce-${nonce}'`],
      styleSrc: [...baseCSP.styleSrc, `'nonce-${nonce}'`],
    };
  }

  const cspValue = buildCSPString(cspConfig);
  res.setHeader("Content-Security-Policy", cspValue);

  // Make nonce available to templates/rendering (production only)
  if (nonce) {
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.cspNonce = nonce;
  }

  // Strict Transport Security
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // X-Frame-Options - Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // X-Content-Type-Options - Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // X-XSS-Protection - Legacy XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy - Disable unnecessary features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // X-DNS-Prefetch-Control
  res.setHeader("X-DNS-Prefetch-Control", "off");

  next();
}

/**
 * CSP Report endpoint handler for logging violations.
 */
export function cspReportHandler(req: Request, res: Response): void {
  const report = req.body;

  // Log CSP violations for analysis
  if (securityEvents && typeof securityEvents.cspViolation === 'function') {
    securityEvents.cspViolation(report);
  } else {
    // Fallback if securityEvents is not fully initialized or mock
    console.warn('CSP Violation:', JSON.stringify(report));
  }

  // In production, this can be integrated with Sentry or other monitoring tools
  res.status(204).send();
}
