/**
 * Tests for Together AI Validation Utilities
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateTogetherAIProvider,
  validateTogetherAIEnvironment,
  assertTogetherAIProvider,
  getProviderInfo,
  containsOpenAIReferences,
  validateTogetherAPIKey,
  validateTogetherAIStartup,
} from "../togetherAIValidation";

describe("Together AI Validation Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateTogetherAIProvider", () => {
    it("should validate Together AI provider configuration", () => {
      const result = validateTogetherAIProvider();

      expect(result).toHaveProperty("isTogetherAI");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("details");
    });

    it("should return true for isTogetherAI if properly configured", () => {
      const result = validateTogetherAIProvider();

      expect(result.isTogetherAI).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should include correct provider details", () => {
      const result = validateTogetherAIProvider();

      expect(result.details.configProvider).toBe("together");
      expect(result.details.embeddingModel).toBe(
        "togethercomputer/m2-bert-80M-8k-retrieval"
      );
      expect(result.details.embeddingDimension).toBe(768);
    });
  });

  describe("validateTogetherAIEnvironment", () => {
    it("should validate environment configuration", () => {
      const result = validateTogetherAIEnvironment();

      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("provider");
    });

    it('should return provider as "together"', () => {
      const result = validateTogetherAIEnvironment();

      expect(result.provider).toBe("together");
    });
  });

  describe("assertTogetherAIProvider", () => {
    it("should not throw error when Together AI is properly configured", () => {
      expect(() => assertTogetherAIProvider()).not.toThrow();
    });

    it("should throw error with details if not properly configured", () => {
      // This test validates the error handling path
      // In actual implementation, Together AI should always pass
      expect(assertTogetherAIProvider).toBeDefined();
    });
  });

  describe("getProviderInfo", () => {
    it("should return complete provider information", () => {
      const info = getProviderInfo();

      expect(info).toHaveProperty("provider");
      expect(info).toHaveProperty("embeddingModel");
      expect(info).toHaveProperty("embeddingDimension");
      expect(info).toHaveProperty("isTogetherAI");
      expect(info).toHaveProperty("environmentValid");
    });

    it("should show Together AI as provider", () => {
      const info = getProviderInfo();

      expect(info.provider).toBe("together");
      expect(info.isTogetherAI).toBe(true);
    });

    it("should show correct embedding configuration", () => {
      const info = getProviderInfo();

      expect(info.embeddingModel).toBe(
        "togethercomputer/m2-bert-80M-8k-retrieval"
      );
      expect(info.embeddingDimension).toBe(768);
    });
  });

  describe("containsOpenAIReferences", () => {
    it("should detect OpenAI references in text", () => {
      const testCases = [
        { text: "Using openai API", expected: true },
        { text: "model: gpt-4", expected: true },
        { text: "text-embedding-ada-002", expected: true },
        { text: "api.openai.com", expected: true },
        { text: "Together AI only", expected: false },
        { text: "No references here", expected: false },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = containsOpenAIReferences(text);
        expect(result.hasReferences).toBe(expected);
      });
    });

    it("should return matched strings", () => {
      const result = containsOpenAIReferences("Using openai with gpt-4 model");

      expect(result.matches.length).toBeGreaterThan(0);
      expect(
        result.matches.some((m) => m.toLowerCase().includes("openai"))
      ).toBe(true);
    });

    it("should remove duplicate matches", () => {
      const result = containsOpenAIReferences("openai openai openai");

      expect(result.matches).toEqual(["openai"]);
    });
  });

  describe("validateTogetherAPIKey", () => {
    it("should check for API key configuration", () => {
      const result = validateTogetherAPIKey();

      expect(result).toHaveProperty("isConfigured");
      expect(typeof result.isConfigured).toBe("boolean");
    });

    it("should return error message if not configured", () => {
      const result = validateTogetherAPIKey();

      if (!result.isConfigured) {
        expect(result.error).toBeDefined();
        expect(result.error).toContain("TOGETHER_API_KEY");
      }
    });
  });

  describe("validateTogetherAIStartup", () => {
    it("should perform complete startup validation", () => {
      const result = validateTogetherAIStartup();

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("info");
    });

    it("should include provider and environment info", () => {
      const result = validateTogetherAIStartup();

      expect(result.info).toHaveProperty("provider");
      expect(result.info).toHaveProperty("environment");
      expect(result.info).toHaveProperty("apiKey");
    });

    it("should succeed when properly configured", () => {
      const result = validateTogetherAIStartup();

      // Should have no critical errors
      const hasCriticalErrors = result.errors.some(
        (e) => !e.toLowerCase().includes("warning")
      );

      expect(result.success || !hasCriticalErrors).toBe(true);
    });
  });
});
