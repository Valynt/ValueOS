/**
 * Together AI Environment Validation Tests
 *
 * Validates that environment validation enforces Together AI as the only provider
 * and properly rejects OpenAI configurations.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateLLMConfig } from "../validateEnv";

describe("Together AI Environment Validation", () => {
  beforeEach(() => {
    // Reset environment before each test
    vi.unstubAllEnvs();
  });

  describe("Provider Validation", () => {
    it('should accept "together" as valid provider', () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "together");

      const result = validateLLMConfig();

      expect(result.provider).toBe("together");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject "openai" as invalid provider', () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "openai");

      const result = validateLLMConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("together");
      expect(result.errors[0]).toContain("only supported provider");
    });

    it('should reject any provider other than "together"', () => {
      const invalidProviders = ["openai", "anthropic", "cohere", "invalid", ""];

      invalidProviders.forEach((provider) => {
        vi.stubEnv("VITE_LLM_PROVIDER", provider);

        const result = validateLLMConfig();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it("should pass validation even without VITE_LLM_PROVIDER set (hard-coded to together)", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "");

      const result = validateLLMConfig();

      // Provider should be 'together' regardless of env var
      expect(result.provider).toBe("together");
    });
  });

  describe("API Key Validation", () => {
    it("should require TOGETHER_API_KEY in production", () => {
      vi.stubEnv("VITE_APP_ENV", "production");
      vi.stubEnv("NODE_ENV", "production");

      const result = validateLLMConfig();

      // Should have error about missing TOGETHER_API_KEY
      const hasTogetherKeyError = result.errors.some((err) =>
        err.includes("TOGETHER_API_KEY")
      );
      expect(hasTogetherKeyError).toBe(true);
    });

    it("should not warn about missing OPENAI_API_KEY", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "together");

      const result = validateLLMConfig();

      // Should NOT have warnings about OpenAI key
      const hasOpenAIWarning = result.warnings.some((warn) =>
        warn.toLowerCase().includes("openai")
      );
      expect(hasOpenAIWarning).toBe(false);
    });

    it("should detect leaked VITE_TOGETHER_API_KEY", () => {
      vi.stubEnv("VITE_TOGETHER_API_KEY", "leaked-key");

      const result = validateLLMConfig();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("VITE_TOGETHER_API_KEY"))
      ).toBe(true);
      expect(result.errors.some((e) => e.includes("SECURITY"))).toBe(true);
    });

    it("should not check for VITE_OPENAI_API_KEY in security validation", () => {
      vi.stubEnv("VITE_OPENAI_API_KEY", "some-key");

      const result = validateLLMConfig();

      // VITE_OPENAI_API_KEY should not be in the leaked keys check anymore
      const hasOpenAISecurityError = result.errors.some((err) =>
        err.includes("VITE_OPENAI_API_KEY")
      );
      expect(hasOpenAISecurityError).toBe(false);
    });
  });

  describe("Provider Availability", () => {
    it("should mark provider as available when TOGETHER_API_KEY is set", () => {
      // Mock Node environment
      if (typeof process !== "undefined") {
        process.env.TOGETHER_API_KEY = "test-key";
      }

      const result = validateLLMConfig();

      expect(result.providerAvailable).toBe(true);

      // Cleanup
      if (typeof process !== "undefined") {
        delete process.env.TOGETHER_API_KEY;
      }
    });
  });
});
