/**
 * Tests for Environment Validation
 * Phase 1: Environment & Configuration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv, validateLLMConfig } from "../validateEnv";

describe("Phase 1: Environment Validation", () => {
  describe("validateLLMConfig", () => {
    beforeEach(() => {
      // Reset environment
      vi.stubEnv("VITE_LLM_PROVIDER", "");
      vi.stubEnv("VITE_LLM_GATING_ENABLED", "");
    });

    it("should pass with valid together provider", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "together");
      vi.stubEnv("VITE_LLM_GATING_ENABLED", "true");
      vi.stubEnv("TOGETHER_API_KEY", "test-key");

      const result = validateLLMConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail with openai provider (no longer supported)", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "openai");
      vi.stubEnv("VITE_LLM_GATING_ENABLED", "false");

      const result = validateLLMConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("together"))).toBe(true);
    });

    it("should fail with invalid provider", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "invalid-provider");

      const result = validateLLMConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("provider"))).toBe(true);
    });

    it("should fail about missing provider", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "");

      const result = validateLLMConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect leaked API keys", () => {
      vi.stubEnv("VITE_TOGETHER_API_KEY", "leaked-key");

      const result = validateLLMConfig();

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("VITE_TOGETHER_API_KEY"))
      ).toBe(true);
    });
  });

  describe("validateEnv", () => {
    it("should validate all environment categories", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "together");
      vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");

      const result = validateEnv();

      expect(result).toHaveProperty("llm");
      expect(result).toHaveProperty("supabase");
      expect(result).toHaveProperty("summary");
    });

    it("should aggregate errors from all validators", () => {
      vi.stubEnv("VITE_LLM_PROVIDER", "invalid");
      vi.stubEnv("VITE_SUPABASE_URL", "");

      const result = validateEnv();

      expect(result.summary.totalErrors).toBeGreaterThan(0);
    });
  });
});
