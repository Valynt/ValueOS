/**
 * Security Headers and Content Security Policy
 * Provides comprehensive HTTP security headers for web applications
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy: {
    enabled: boolean;
    directives: CSPDirectives;
    reportOnly?: boolean;
  };
  strictTransportSecurity: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions: {
    enabled: boolean;
    value: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
    allowFrom?: string;
  };
  xContentTypeOptions: {
    enabled: boolean;
  };
  xXSSProtection: {
    enabled: boolean;
    mode: "0" | "1; mode=block";
  };
  referrerPolicy: {
    enabled: boolean;
    policy: string;
  };
  permissionsPolicy: {
    enabled: boolean;
    features: string[];
  };
}

export interface CSPDirectives {
  "default-src"?: string;
  "script-src"?: string;
  "style-src"?: string;
  "img-src"?: string;
  "font-src"?: string;
  "connect-src"?: string;
  "media-src"?: string;
  "object-src"?: string;
  "child-src"?: string;
  "frame-src"?: string;
  "worker-src"?: string;
  "manifest-src"?: string;
  "base-uri"?: string;
  "form-action"?: string;
  "frame-ancestors"?: string;
  "upgrade-insecure-requests"?: string | null;
  "block-all-mixed-content"?: string | null;
  "report-uri"?: string;
  "report-to"?: string;
}

class SecurityHeaders {
  private static instance: SecurityHeaders;
  private config: SecurityHeadersConfig;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): SecurityHeaders {
    if (!SecurityHeaders.instance) {
      SecurityHeaders.instance = new SecurityHeaders();
    }
    return SecurityHeaders.instance;
  }

  /**
   * Get default security configuration
   */
  private getDefaultConfig(): SecurityHeadersConfig {
    return {
      contentSecurityPolicy: {
        enabled: true,
        directives: {
          "default-src": "'self'",
          "script-src":
            "'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
          "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src": "'self' data: https: blob:",
          "font-src": "'self' https://fonts.gstatic.com",
          "connect-src": "'self' https://api.valueos.com https://*.valueos.com wss://*.valueos.com",
          "media-src": "'self'",
          "object-src": "'none'",
          "child-src": "'self'",
          "frame-src": "'none'",
          "worker-src": "'self' blob:",
          "manifest-src": "'self'",
          "base-uri": "'self'",
          "form-action": "'self'",
          "frame-ancestors": "'none'",
          "upgrade-insecure-requests": null,
          "block-all-mixed-content": null,
          "report-uri": "https://api.valueos.com/security/csp-report",
        },
        reportOnly: process.env.NODE_ENV === "development",
      },
      strictTransportSecurity: {
        enabled: true,
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: {
        enabled: true,
        value: "DENY",
      },
      xContentTypeOptions: {
        enabled: true,
      },
      xXSSProtection: {
        enabled: true,
        mode: "1; mode=block",
      },
      referrerPolicy: {
        enabled: true,
        policy: "strict-origin-when-cross-origin",
      },
      permissionsPolicy: {
        enabled: true,
        features: [
          "geolocation=()",
          "microphone=()",
          "camera=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
          "ambient-light-sensor=()",
          "autoplay=()",
          "encrypted-media=()",
          "fullscreen=()",
          "picture-in-picture=()",
        ],
      },
    };
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityHeadersConfig>): void {
    this.config = this.mergeConfigs(this.config, newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }

  /**
   * Generate all security headers
   */
  generateHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (this.config.contentSecurityPolicy.enabled) {
      const csp = this.generateCSP();
      const headerName = this.config.contentSecurityPolicy.reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
      headers[headerName] = csp;
    }

    // Strict Transport Security
    if (this.config.strictTransportSecurity.enabled) {
      headers["Strict-Transport-Security"] = this.generateHSTS();
    }

    // X-Frame-Options
    if (this.config.xFrameOptions.enabled) {
      headers["X-Frame-Options"] = this.generateXFrameOptions();
    }

    // X-Content-Type-Options
    if (this.config.xContentTypeOptions.enabled) {
      headers["X-Content-Type-Options"] = "nosniff";
    }

    // X-XSS-Protection
    if (this.config.xXSSProtection.enabled) {
      headers["X-XSS-Protection"] = this.config.xXSSProtection.mode;
    }

    // Referrer Policy
    if (this.config.referrerPolicy.enabled) {
      headers["Referrer-Policy"] = this.config.referrerPolicy.policy;
    }

    // Permissions Policy
    if (this.config.permissionsPolicy.enabled) {
      headers["Permissions-Policy"] = this.config.permissionsPolicy.features.join(", ");
    }

    // Additional security headers
    headers["X-Permitted-Cross-Domain-Policies"] = "none";
    headers["X-Download-Options"] = "noopen";
    headers["X-Robots-Tag"] = "noindex, nofollow, nosnippet, noarchive";
    headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    headers["Cross-Origin-Resource-Policy"] = "same-origin";
    headers["Cross-Origin-Opener-Policy"] = "same-origin";

    return headers;
  }

  /**
   * Generate Content Security Policy
   */
  private generateCSP(): string {
    const directives = this.config.contentSecurityPolicy.directives;
    const cspParts: string[] = [];

    Object.entries(directives).forEach(([directive, value]) => {
      if (value !== null && value !== undefined) {
        cspParts.push(`${directive} ${value}`);
      } else if (directive.includes("upgrade") || directive.includes("block-all")) {
        cspParts.push(directive);
      }
    });

    return cspParts.join("; ");
  }

  /**
   * Generate HSTS header
   */
  private generateHSTS(): string {
    const { maxAge, includeSubDomains, preload } = this.config.strictTransportSecurity;
    let hsts = `max-age=${maxAge}`;

    if (includeSubDomains) {
      hsts += "; includeSubDomains";
    }

    if (preload) {
      hsts += "; preload";
    }

    return hsts;
  }

  /**
   * Generate X-Frame-Options header
   */
  private generateXFrameOptions(): string {
    const { value, allowFrom } = this.config.xFrameOptions;

    if (value === "ALLOW-FROM" && allowFrom) {
      return `ALLOW-FROM ${allowFrom}`;
    }

    return value;
  }

  /**
   * Apply security headers to fetch requests
   */
  applyToFetchRequest(options: RequestInit): RequestInit {
    const headers = new Headers(options.headers);
    const securityHeaders = this.generateHeaders();

    Object.entries(securityHeaders).forEach(([name, value]) => {
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    });

    return {
      ...options,
      headers,
    };
  }

  /**
   * Apply security headers to response (server-side)
   */
  applyToResponse(response: Response): Response {
    const securityHeaders = this.generateHeaders();

    Object.entries(securityHeaders).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    return response;
  }

  /**
   * Validate CSP configuration
   */
  validateCSP(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const directives = this.config.contentSecurityPolicy.directives;

    // Check for required directives
    if (!directives["default-src"]) {
      errors.push("default-src directive is required");
    }

    if (!directives["script-src"]) {
      errors.push("script-src directive is recommended");
    }

    // Check for unsafe values
    if (directives["script-src"]?.includes("unsafe-eval")) {
      errors.push("unsafe-eval in script-src is not recommended for production");
    }

    if (directives["script-src"]?.includes("unsafe-inline")) {
      errors.push("unsafe-inline in script-src is not recommended for production");
    }

    // Check frame protection
    if (!directives["frame-ancestors"] || directives["frame-ancestors"] !== "'none'") {
      errors.push("frame-ancestors should be set to none for clickjacking protection");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate nonce for CSP
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    let result = "";
    for (let i = 0; i < array.length; i++) {
      result += String.fromCharCode(array[i]);
    }
    return btoa(result).replace(/[/+=]/g, "");
  }

  /**
   * Add nonce to CSP directives
   */
  addNonceToDirective(directive: "script-src" | "style-src", nonce: string): void {
    const currentValue = this.config.contentSecurityPolicy.directives[directive] || "";
    const newValue = `${currentValue} 'nonce-${nonce}'`.trim();
    this.config.contentSecurityPolicy.directives[directive] = newValue;
  }

  /**
   * Get CSP violation report handler
   */
  getCSPViolationHandler(): (event: SecurityPolicyViolationEvent) => void {
    return (event: SecurityPolicyViolationEvent) => {
      const violation = {
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        referrer: event.referrer,
        sourceFile: event.sourceFile,
        sample: event.sample,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      };

      // Log CSP violation
      console.warn("CSP Violation:", violation);

      // Send to monitoring service
      this.sendCSPViolationReport(violation);
    };
  }

  /**
   * Send CSP violation report to monitoring service
   */
  private sendCSPViolationReport(violation: unknown): void {
    if (process.env.NODE_ENV === "production") {
      // Raw fetch retained: CSP violation reports fire from a SecurityPolicyViolationEvent
      // handler that runs outside React context. apiClient requires auth context.
      // Migrate when apiClient exposes an unauthenticated reporting method.
       
      fetch("/api/security/csp-violation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(violation),
      }).catch((error) => {
        console.error("Failed to send CSP violation report:", error);
      });
    }
  }

  /**
   * Setup CSP violation monitoring
   */
  setupCSPMonitoring(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("securitypolicyviolation", this.getCSPViolationHandler());
    }
  }

  /**
   * Merge configurations
   */
  private mergeConfigs(
    base: SecurityHeadersConfig,
    update: Partial<SecurityHeadersConfig>
  ): SecurityHeadersConfig {
    return {
      contentSecurityPolicy: {
        ...base.contentSecurityPolicy,
        ...update.contentSecurityPolicy,
        directives: {
          ...base.contentSecurityPolicy.directives,
          ...update.contentSecurityPolicy?.directives,
        },
      },
      strictTransportSecurity: {
        ...base.strictTransportSecurity,
        ...update.strictTransportSecurity,
      },
      xFrameOptions: {
        ...base.xFrameOptions,
        ...update.xFrameOptions,
      },
      xContentTypeOptions: {
        ...base.xContentTypeOptions,
        ...update.xContentTypeOptions,
      },
      xXSSProtection: {
        ...base.xXSSProtection,
        ...update.xXSSProtection,
      },
      referrerPolicy: {
        ...base.referrerPolicy,
        ...update.referrerPolicy,
      },
      permissionsPolicy: {
        ...base.permissionsPolicy,
        ...update.permissionsPolicy,
      },
    };
  }

  /**
   * Get security score based on configuration
   */
  getSecurityScore(): { score: number; maxScore: number; recommendations: string[] } {
    let score = 0;
    const maxScore = 10;
    const recommendations: string[] = [];

    // CSP enabled
    if (this.config.contentSecurityPolicy.enabled) {
      score += 2;
    } else {
      recommendations.push("Enable Content Security Policy");
    }

    // HSTS enabled
    if (this.config.strictTransportSecurity.enabled) {
      score += 2;
    } else {
      recommendations.push("Enable Strict Transport Security");
    }

    // Frame protection
    if (this.config.xFrameOptions.enabled) {
      score += 1;
    } else {
      recommendations.push("Enable X-Frame-Options");
    }

    // XSS protection
    if (this.config.xXSSProtection.enabled) {
      score += 1;
    } else {
      recommendations.push("Enable X-XSS-Protection");
    }

    // Content type protection
    if (this.config.xContentTypeOptions.enabled) {
      score += 1;
    } else {
      recommendations.push("Enable X-Content-Type-Options");
    }

    // Referrer policy
    if (this.config.referrerPolicy.enabled) {
      score += 1;
    } else {
      recommendations.push("Enable Referrer Policy");
    }

    // Permissions policy
    if (this.config.permissionsPolicy.enabled) {
      score += 1;
    } else {
      recommendations.push("Enable Permissions Policy");
    }

    // CSP validation
    const cspValidation = this.validateCSP();
    if (cspValidation.valid) {
      score += 1;
    } else {
      recommendations.push(...cspValidation.errors);
    }

    return { score, maxScore, recommendations };
  }
}

// Export singleton instance
export const securityHeaders = SecurityHeaders.getInstance();
