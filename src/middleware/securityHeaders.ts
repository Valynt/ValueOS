import { Request, Response, NextFunction } from "express";

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
}

const productionCSP: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    // NO 'unsafe-inline' - blocks inline scripts
    // Add specific hashes for legitimate inline scripts if needed
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind, consider using hashes in future
  ],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: [
    "'self'",
    process.env.VITE_SUPABASE_URL || "",
    "https://api.openai.com",
    "wss://*.supabase.co", // WebSocket connections
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  workerSrc: ["'self'", "blob:"],
  reportUri: "/api/csp-report",
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
  // Content Security Policy
  res.setHeader("Content-Security-Policy", buildCSPString(productionCSP));

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
  console.warn("CSP Violation detected:", JSON.stringify(report, null, 2));

  // In production, this can be integrated with Sentry or other monitoring tools
  res.status(204).send();
}
