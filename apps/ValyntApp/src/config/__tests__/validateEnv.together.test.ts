/**
 * Together AI Environment Validation Tests
 *
 * Validates that environment validation enforces Together AI as the only provider.
 * Provider is hardcoded to "together" — VITE_LLM_PROVIDER has no effect.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateLLMConfig } from "../validateEnv";

describe("Together AI Environment Validation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Provider Validation", () => {
    it('should always report provider as "together" regardless of env', () => {
      const result = validateLLMConfig();
      expect(result.provider).toBe("together");
    });

    it("should pass validation when TOGETHER_API_KEY is set", () => {
      vi.stubEnv("TOGETHER_API_KEY", "test-key-abc");

      const result = validateLLMConfig();

      expect(result.provider).toBe("together");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when TOGETHER_API_KEY is missing", () => {
      vi.stubEnv("TOGETHER_API_KEY", "");

      const result = validateLLMConfig();

      expect(result.errors.some(e => e.includes("TOGETHER_API_KEY"))).toBe(true);
    });
  });

  describe("API Key Validation", () => {
    it("should require TOGETHER_API_KEY in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TOGETHER_API_KEY", "");

      const result = validateLLMConfig();

      expect(result.errors.some(e => e.includes("TOGETHER_API_KEY"))).toBe(true);
    });

    it("should not warn about missing OPENAI_API_KEY", () => {
      const result = validateLLMConfig();

      const hasOpenAIWarning = result.warnings.some(w =>
        w.toLowerCase().includes("openai")
      );
      expect(hasOpenAIWarning).toBe(false);
    });

    it("should detect leaked VITE_TOGETHER_API_KEY", () => {
      vi.stubEnv("VITE_TOGETHER_API_KEY", "leaked-key");

      const result = validateLLMConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("VITE_TOGETHER_API_KEY"))).toBe(true);
      expect(result.errors.some(e => e.includes("SECURITY"))).toBe(true);
    });

    it("should not flag VITE_OPENAI_API_KEY as a security error", () => {
      vi.stubEnv("VITE_OPENAI_API_KEY", "some-key");

      const result = validateLLMConfig();

      expect(result.errors.some(e => e.includes("VITE_OPENAI_API_KEY"))).toBe(false);
    });
  });

  describe("Provider Availability", () => {
    it("should mark provider as available when TOGETHER_API_KEY is set", () => {
      vi.stubEnv("TOGETHER_API_KEY", "test-key");

      const result = validateLLMConfig();

      expect(result.providerAvailable).toBe(true);
    });
  });
});
