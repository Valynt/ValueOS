/**
 * Together AI Configuration Tests
 *
 * Validates that Together AI is hard-coded as the sole LLM provider
 * and that OpenAI has been completely removed from configuration.
 */

import { describe, expect, it } from "vitest";

import { llmConfig, semanticMemoryConfig } from "../llm";

describe("Together AI Configuration", () => {
  describe("Provider Configuration", () => {
    it('should hard-code provider to "together"', () => {
      expect(llmConfig.provider).toBe("together");
    });

    it('should not allow provider to be "openai"', () => {
      expect(llmConfig.provider).not.toBe("openai");
    });

    it("should have provider property that is immutable", () => {
      const originalProvider = llmConfig.provider;

      // Attempt to modify (should not work due to const)
      try {
        (llmConfig as any).provider = "openai";
      } catch (e) {
        // Expected in strict mode
      }

      expect(llmConfig.provider).toBe(originalProvider);
      expect(llmConfig.provider).toBe("together");
    });
  });

  describe("Embedding Model Configuration", () => {
    it("should use Together AI embedding model", () => {
      expect(semanticMemoryConfig.embeddingModel).toBe(
        "togethercomputer/m2-bert-80M-8k-retrieval"
      );
    });

    it("should not use OpenAI embedding model", () => {
      expect(semanticMemoryConfig.embeddingModel).not.toContain("openai");
      expect(semanticMemoryConfig.embeddingModel).not.toBe(
        "text-embedding-3-small"
      );
      expect(semanticMemoryConfig.embeddingModel).not.toBe(
        "text-embedding-ada-002"
      );
    });

    it("should have correct embedding dimensions for Together AI model", () => {
      // Together AI embedding model uses 768 dimensions
      expect(semanticMemoryConfig.embeddingDimension).toBe(768);

      // Not OpenAI dimensions (1536)
      expect(semanticMemoryConfig.embeddingDimension).not.toBe(1536);
    });
  });

  describe("Configuration Export", () => {
    it('should export provider as "together" in llmConfig', () => {
      const config = llmConfig;

      expect(config).toHaveProperty("provider");
      expect(config.provider).toBe("together");
    });

    it("should not have any OpenAI-related configuration", () => {
      const configStr = JSON.stringify(llmConfig);

      // Check that no OpenAI references exist in the config
      expect(configStr.toLowerCase()).not.toContain("openai");
    });
  });
});
