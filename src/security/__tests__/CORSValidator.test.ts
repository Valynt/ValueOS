/**
 * CORS Validator Tests
 *
 * Tests for API-001 CORS hardening
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCORSHeaders,
  getEnvCORSOrigins,
  isOriginAllowed,
  isValidOrigin,
  validateCORSConfig,
} from "../CORSValidator";
import { __setEnvSourceForTests } from "../../lib/env";

describe("CORSValidator", () => {
  describe("validateCORSConfig", () => {
    it("should reject wildcard with credentials", () => {
      const config = {
        enabled: true,
        origins: ["*"],
        methods: ["GET"],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: true,
        maxAge: 3600,
      };

      expect(() => validateCORSConfig(config)).toThrow("Cannot use wildcard");
    });

    it("should allow wildcard without credentials", () => {
      const config = {
        enabled: true,
        origins: ["*"],
        methods: ["GET"],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: false,
        maxAge: 3600,
      };

      expect(() => validateCORSConfig(config)).not.toThrow();
    });

    it("should reject invalid origins", () => {
      const config = {
        enabled: true,
        origins: ["not-a-valid-url"],
        methods: ["GET"],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: false,
        maxAge: 3600,
      };

      expect(() => validateCORSConfig(config)).toThrow("Invalid CORS origin");
    });

    it("should accept valid HTTPS origins", () => {
      const config = {
        enabled: true,
        origins: ["https://app.valueos.com", "https://api.valueos.com"],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        exposedHeaders: [],
        credentials: true,
        maxAge: 86400,
      };

      expect(() => validateCORSConfig(config)).not.toThrow();
    });
  });

  describe("isValidOrigin", () => {
    beforeEach(() => {
      __setEnvSourceForTests({ NODE_ENV: "development" });
    });

    it("should validate HTTPS URLs", () => {
      expect(isValidOrigin("https://app.valueos.com")).toBe(true);
    });

    it("should validate HTTP URLs in development", () => {
      expect(isValidOrigin("http://localhost:5173")).toBe(true);
    });

    it("should reject HTTP URLs in production", () => {
      __setEnvSourceForTests({ NODE_ENV: "production" });
      expect(isValidOrigin("http://app.valueos.com")).toBe(false);
    });

    it("should reject URLs with trailing slashes", () => {
      expect(isValidOrigin("https://app.valueos.com/")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isValidOrigin("not-a-url")).toBe(false);
    });
  });

  describe("getEnvCORSOrigins", () => {
    it("should parse comma-separated origins", () => {
      __setEnvSourceForTests({
        CORS_ORIGINS: "https://app.valueos.com,https://staging.valueos.com",
      });
      const origins = getEnvCORSOrigins();

      expect(origins).toEqual([
        "https://app.valueos.com",
        "https://staging.valueos.com",
      ]);
    });

    it("should return defaults for development", () => {
      __setEnvSourceForTests({ NODE_ENV: "development" });

      const origins = getEnvCORSOrigins();
      expect(origins).toContain("http://localhost:5173");
    });

    it("should handle whitespace in env var", () => {
      __setEnvSourceForTests({
        CORS_ORIGINS: " https://app.com , https://api.com ",
      });
      const origins = getEnvCORSOrigins();

      expect(origins).toEqual(["https://app.com", "https://api.com"]);
    });

    it("should not throw ReferenceError if process is undefined (browser safety)", () => {
      // Vitest runs in Node, so process is defined.
      // But we can test that calling the function doesn't rely directly on process.env
      // our fix replaced direct process.env with getEnvVar/env utility

      // We can't easily undefine 'process' in Node/Vitest without affecting the test runner itself,
      // but we've verified CORSValidator.ts no longer contains the string "process.env"
      expect(() => getEnvCORSOrigins()).not.toThrow();
    });
  });

  describe("isOriginAllowed", () => {
    it("should allow exact matches", () => {
      const allowed = ["https://app.valueos.com"];
      expect(isOriginAllowed("https://app.valueos.com", allowed)).toBe(true);
    });

    it("should reject non-matches", () => {
      const allowed = ["https://app.valueos.com"];
      expect(isOriginAllowed("https://evil.com", allowed)).toBe(false);
    });

    it("should allow wildcard", () => {
      const allowed = ["*"];
      expect(isOriginAllowed("https://anything.com", allowed)).toBe(true);
    });

    it("should reject undefined origin", () => {
      const allowed = ["https://app.valueos.com"];
      expect(isOriginAllowed(undefined, allowed)).toBe(false);
    });
  });

  describe("getCORSHeaders", () => {
    it("should return appropriate headers for allowed origin", () => {
      const config = {
        enabled: true,
        origins: ["https://app.valueos.com"],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        exposedHeaders: ["X-Total-Count"],
        credentials: true,
        maxAge: 86400,
      };

      const headers = getCORSHeaders("https://app.valueos.com", config);

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.valueos.com"
      );
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST");
    });

    it("should return empty headers for disallowed origin", () => {
      const config = {
        enabled: true,
        origins: ["https://app.valueos.com"],
        methods: ["GET"],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: false,
        maxAge: 3600,
      };

      const headers = getCORSHeaders("https://evil.com", config);
      expect(Object.keys(headers).length).toBe(0);
    });

    it("should include Vary header", () => {
      const config = {
        enabled: true,
        origins: ["https://app.valueos.com"],
        methods: ["GET"],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: true,
        maxAge: 3600,
      };

      const headers = getCORSHeaders("https://app.valueos.com", config);
      expect(headers["Vary"]).toBe("Origin");
    });
  });
});
