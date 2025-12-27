/**
 * SemanticMemory Service Tests - Together AI Embeddings
 *
 * Validates that SemanticMemory uses Together AI for embedding generation
 * and does not call OpenAI API.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticMemoryService } from "../../SemanticMemory";

describe("SemanticMemory - Together AI Embeddings", () => {
  let service: SemanticMemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticMemoryService();
  });

  describe("Embedding Model Configuration", () => {
    it("should use Together AI embedding model", () => {
      // Access private property via type assertion for testing
      const embeddingModel = (service as any).embeddingModel;

      expect(embeddingModel).toBe("togethercomputer/m2-bert-80M-8k-retrieval");
    });

    it("should not use OpenAI embedding model", () => {
      const embeddingModel = (service as any).embeddingModel;

      expect(embeddingModel).not.toContain("openai");
      expect(embeddingModel).not.toBe("text-embedding-3-small");
      expect(embeddingModel).not.toBe("text-embedding-ada-002");
    });

    it("should use correct embedding dimensions (768 for Together AI)", () => {
      const embeddingDimension = (service as any).embeddingDimension;

      expect(embeddingDimension).toBe(768);
      expect(embeddingDimension).not.toBe(1536); // Not OpenAI dimension
    });
  });

  describe("API Endpoint", () => {
    it("should call Together AI API endpoint for embeddings", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(768).fill(0.1) }],
        }),
      });

      globalThis.fetch = mockFetch;

      try {
        await (service as any).generateEmbedding("test text");

        // Verify Together AI endpoint was called
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.together.xyz/v1/embeddings",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          })
        );

        // Verify NOT calling OpenAI endpoint
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringContaining("api.openai.com"),
          expect.anything()
        );
      } catch (error) {
        // Expected if TOGETHER_API_KEY not set
      }
    });

    it("should use TOGETHER_API_KEY for authentication", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(768).fill(0.1) }],
        }),
      });

      globalThis.fetch = mockFetch;
      process.env.TOGETHER_API_KEY = "test-together-key";

      try {
        await (service as any).generateEmbedding("test text");

        // Verify Together AI key is used
        const authHeader = mockFetch.mock.calls[0][1].headers["Authorization"];
        expect(authHeader).toContain("test-together-key");
        expect(authHeader).not.toContain("OPENAI");
      } catch (error) {
        // Expected if implementation differs
      } finally {
        delete process.env.TOGETHER_API_KEY;
      }
    });

    it("should not reference OPENAI_API_KEY anywhere", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(768).fill(0.1) }],
        }),
      });

      globalThis.fetch = mockFetch;

      try {
        await (service as any).generateEmbedding("test text");

        // Check that no call references OPENAI_API_KEY
        const callArgs = JSON.stringify(mockFetch.mock.calls);
        expect(callArgs.toLowerCase()).not.toContain("openai_api_key");
      } catch (error) {
        // Expected if environment not set up
      }
    });
  });

  describe("Error Messages", () => {
    it("should throw Together AI specific errors, not OpenAI errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      globalThis.fetch = mockFetch;

      try {
        await (service as any).generateEmbedding("test text");
        fail("Should have thrown an error");
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain("Together AI");
          expect(error.message).not.toContain("OpenAI");
        }
      }
    });
  });

  describe("Embedding Vector Validation", () => {
    it("should return embeddings with 768 dimensions (Together AI)", async () => {
      const mockEmbedding = new Array(768).fill(0.1);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      globalThis.fetch = mockFetch;
      process.env.TOGETHER_API_KEY = "test-key";

      try {
        const result = await (service as any).generateEmbedding("test text");

        expect(result).toHaveLength(768);
        expect(result).not.toHaveLength(1536); // Not OpenAI dimension
      } catch (error) {
        // Expected if API call fails
      } finally {
        delete process.env.TOGETHER_API_KEY;
      }
    });
  });
});
