/**
 * OWASP Security Hardening Test Suite
 * Comprehensive tests for all security features
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import {
  getSecurityConfig,
  productionSecurityConfig,
  developmentSecurityConfig,
  applySecurityHeaders,
  validateFileUpload,
  generateCSRFToken,
  validateSSRFUrl,
} from "../config/securityConfig";

// Mock crypto for consistent testing
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn((size) => Buffer.from("a".repeat(size))),
  },
}));

describe("OWASP Security Hardening", () => {
  describe("Security Configuration", () => {
    it("should return production config in production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = getSecurityConfig();
      expect(config).toEqual(productionSecurityConfig);

      process.env.NODE_ENV = originalEnv;
    });

    it("should return development config in development environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = getSecurityConfig();
      expect(config).toEqual(developmentSecurityConfig);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Security Headers Application", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let setHeaderSpy: vi.SpyInstance;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        setHeader: vi.fn(),
      };
      setHeaderSpy = vi.spyOn(mockRes, "setHeader");
    });

    it("should apply all security headers in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      applySecurityHeaders(mockReq as Request, mockRes as Response);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.stringContaining("default-src 'self'")
      );
      expect(setHeaderSpy).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
      );
      expect(setHeaderSpy).toHaveBeenCalledWith("X-Frame-Options", "DENY");
      expect(setHeaderSpy).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      expect(setHeaderSpy).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
      expect(setHeaderSpy).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
      );
      expect(setHeaderSpy).toHaveBeenCalledWith(
        "Permissions-Policy",
        expect.stringContaining("camera=()")
      );
      expect(setHeaderSpy).toHaveBeenCalledWith("X-DNS-Prefetch-Control", "off");
      expect(setHeaderSpy).toHaveBeenCalledWith("Cross-Origin-Embedder-Policy", "require-corp");
      expect(setHeaderSpy).toHaveBeenCalledWith("Cross-Origin-Opener-Policy", "same-origin");
      expect(setHeaderSpy).toHaveBeenCalledWith("Cross-Origin-Resource-Policy", "same-origin");

      process.env.NODE_ENV = originalEnv;
    });

    it("should apply relaxed CSP in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      applySecurityHeaders(mockReq as Request, mockRes as Response);

      const cspCall = setHeaderSpy.mock.calls.find((call) => call[0] === "Content-Security-Policy");
      expect(cspCall?.[1]).toContain("'unsafe-eval'");
      expect(cspCall?.[1]).toContain("'unsafe-inline'");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("File Upload Validation", () => {
    const config = getSecurityConfig().fileUpload;

    it("should accept valid file uploads", () => {
      const validFile = {
        size: 1024 * 1024, // 1MB
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      const result = validateFileUpload(validFile, config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject files that are too large", () => {
      const largeFile = {
        size: 20 * 1024 * 1024, // 20MB
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      const result = validateFileUpload(largeFile, config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed size");
    });

    it("should reject files with disallowed types", () => {
      const invalidFile = {
        size: 1024 * 1024,
        mimetype: "application/exe",
      } as Express.Multer.File;

      const result = validateFileUpload(invalidFile, config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });
  });

  describe("CSRF Token Generation", () => {
    it("should generate tokens of correct length", async () => {
      const config = getSecurityConfig().csrf;
      const token = await generateCSRFToken(config);
      expect(token).toHaveLength(config.tokenLength * 2); // hex encoding doubles length
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("SSRF Protection", () => {
    const config = getSecurityConfig().ssrf;

    it("should allow valid URLs", () => {
      const validUrls = [
        "https://api.supabase.co/v1/auth",
        "https://api.openai.com/v1/chat/completions",
        "https://example.supabase.co/db",
      ];

      validUrls.forEach((url) => {
        const result = validateSSRFUrl(url, config);
        expect(result.valid).toBe(true);
      });
    });

    it("should block localhost URLs", () => {
      const blockedUrls = [
        "http://localhost:3000/api",
        "https://127.0.0.1:8080/data",
        "http://0.0.0.0:8000/test",
      ];

      blockedUrls.forEach((url) => {
        const result = validateSSRFUrl(url, config);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("blocked by SSRF protection");
      });
    });

    it("should block disallowed ports", () => {
      const url = "https://api.supabase.co:22/api"; // SSH port
      const result = validateSSRFUrl(url, config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Port 22 not allowed");
    });

    it("should reject invalid URLs", () => {
      const invalidUrls = [
        "not-a-url",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
      ];

      invalidUrls.forEach((url) => {
        const result = validateSSRFUrl(url, config);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid URL format");
      });
    });
  });

  describe("Session/Cookie Security", () => {
    it("should have secure session configuration in production", () => {
      const config = productionSecurityConfig.session;
      expect(config.secure).toBe(true);
      expect(config.httpOnly).toBe(true);
      expect(config.sameSite).toBe("strict");
      expect(config.maxAge).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it("should have relaxed session configuration in development", () => {
      const config = developmentSecurityConfig.session;
      expect(config.secure).toBe(false);
      expect(config.sameSite).toBe("lax");
    });
  });

  describe("CORS Configuration", () => {
    it("should have secure CORS settings", () => {
      const config = productionSecurityConfig.cors;
      expect(config.credentials).toBe(true);
      expect(config.methods).toContain("GET");
      expect(config.methods).toContain("POST");
      expect(config.headers).toContain("Authorization");
      expect(config.headers).toContain("X-CSRF-Token");
      expect(config.maxAge).toBe(86400);
    });
  });

  describe("Content Security Policy", () => {
    it("should have strict CSP in production", () => {
      const csp = productionSecurityConfig.csp;
      expect(csp.defaultSrc).toEqual(["'self'"]);
      expect(csp.scriptSrc).toEqual(["'self'", "'strict-dynamic'"]);
      expect(csp.objectSrc).toEqual(["'none'"]);
      expect(csp.frameAncestors).toEqual(["'none'"]);
      expect(csp.upgradeInsecureRequests).toBe(true);
    });

    it("should have relaxed CSP in development", () => {
      const csp = developmentSecurityConfig.csp;
      expect(csp.scriptSrc).toContain("'unsafe-eval'");
      expect(csp.styleSrc).toContain("'unsafe-inline'");
      expect(csp.connectSrc).toContain("ws://localhost:*");
    });
  });

  describe("XSS Protection", () => {
    it("should have XSS protection enabled", () => {
      const xss = productionSecurityConfig.xXssProtection;
      expect(xss.enabled).toBe(true);
      expect(xss.mode).toBe("block");
    });
  });

  describe("Clickjacking Protection", () => {
    it("should deny framing", () => {
      expect(productionSecurityConfig.xFrameOptions).toBe("DENY");
    });
  });

  describe("MIME Sniffing Protection", () => {
    it("should prevent MIME sniffing", () => {
      expect(productionSecurityConfig.xContentTypeOptions).toBe("nosniff");
    });
  });

  describe("HSTS Configuration", () => {
    it("should have secure HSTS settings", () => {
      const hsts = productionSecurityConfig.hsts;
      expect(hsts.maxAge).toBe(31536000);
      expect(hsts.includeSubDomains).toBe(true);
      expect(hsts.preload).toBe(true);
    });
  });

  describe("Permissions Policy", () => {
    it("should restrict unnecessary permissions", () => {
      const permissions = productionSecurityConfig.permissionsPolicy;
      expect(permissions.camera).toEqual([]);
      expect(permissions.microphone).toEqual([]);
      expect(permissions.geolocation).toEqual([]);
    });
  });
});

// Integration tests for middleware
describe("Security Middleware Integration", () => {
  it("should integrate with Express middleware chain", async () => {
    const { applySecurityHeaders } = await import("../config/securityConfig");

    const mockReq = {} as Request;
    const mockRes = {
      setHeader: vi.fn(),
    } as Partial<Response>;

    applySecurityHeaders(mockReq, mockRes as Response);

    // Verify multiple headers are set
    expect(mockRes.setHeader).toHaveBeenCalledTimes(12); // All security headers
  });
});

// Performance tests
describe("Security Performance", () => {
  it("should validate SSRF quickly", () => {
    const start = Date.now();
    const result = validateSSRFUrl("https://api.supabase.co/v1/auth");
    const end = Date.now();

    expect(result.valid).toBe(true);
    expect(end - start).toBeLessThan(10); // Should complete in < 10ms
  });

  it("should generate CSRF tokens quickly", async () => {
    const start = Date.now();
    const token = await generateCSRFToken();
    const end = Date.now();

    expect(token).toBeDefined();
    expect(end - start).toBeLessThan(5); // Should complete in < 5ms
  });
});

// Edge case tests
describe("Security Edge Cases", () => {
  it("should handle malformed file objects", () => {
    const malformedFile = {
      size: "not-a-number",
      mimetype: undefined,
    } as any;

    expect(() => validateFileUpload(malformedFile)).not.toThrow();
  });

  it("should handle URLs with unusual characters", () => {
    const urls = [
      "https://api.supabase.co/path with spaces",
      "https://api.supabase.co/path%20with%20encoding",
      "https://api.supabase.co/path?query=value&other=test",
    ];

    urls.forEach((url) => {
      const result = validateSSRFUrl(url);
      expect(result.valid).toBe(true);
    });
  });

  it("should handle environment variable parsing for CORS", () => {
    const originalEnv = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = "https://example.com,https://test.com";

    const config = getSecurityConfig();
    expect(config.cors.origins).toContain("https://example.com");
    expect(config.cors.origins).toContain("https://test.com");

    process.env.CORS_ALLOWED_ORIGINS = originalEnv;
  });
});
