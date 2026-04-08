import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebScraperService } from "../WebScraperService.js";

describe("WebScraperService entity extraction", () => {
  beforeEach(() => {
    process.env.WEB_SCRAPER_ENCRYPTION_KEY = "c".repeat(64);
  });

  it("adds entity_extraction when LLM extraction succeeds", async () => {
    const service = new WebScraperService();
    const scrapeSpy = vi.spyOn(service, "scrape").mockResolvedValue({
      url: "https://example.com",
      title: "Example Company",
      h1_tags: ["Example Platform"],
      main_content:
        "Example Company provides analytics software for enterprise teams. " +
        "Customers report reduced reporting cycle time and improved forecast accuracy.",
      relevance_score: 82,
    });

    const complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        entities: [
          {
            name: "Example Company",
            type: "company",
            confidence_score: 0.9,
            evidence_snippet: "Example Company provides analytics software",
          },
          {
            name: "analytics software",
            type: "product",
            confidence_score: 0.78,
            evidence_snippet: "provides analytics software for enterprise teams",
          },
        ],
      }),
    });

    const result = await service.scrapeWithEntityExtraction({
      url: "https://example.com",
      tenantId: "tenant-123",
      llmGateway: { complete },
      maxRetries: 1,
      maxEntities: 5,
      model: "test-model",
    });

    expect(scrapeSpy).toHaveBeenCalledWith("https://example.com", 1);
    expect(result?.entity_extraction?.entities).toHaveLength(2);
    expect(result?.entity_extraction?.entities[0]?.name).toBe("Example Company");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].metadata.tenantId).toBe("tenant-123");
  });

  it("returns base scrape result when extraction fails", async () => {
    const service = new WebScraperService();
    vi.spyOn(service, "scrape").mockResolvedValue({
      url: "https://example.com",
      title: "Example Company",
      h1_tags: ["Example Platform"],
      main_content:
        "Example Company provides analytics software for enterprise teams. " +
        "Customers report reduced reporting cycle time and improved forecast accuracy.",
      relevance_score: 82,
    });

    const result = await service.scrapeWithEntityExtraction({
      url: "https://example.com",
      tenantId: "tenant-123",
      llmGateway: {
        complete: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      },
      maxRetries: 1,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Example Company");
    expect(result?.entity_extraction).toBeUndefined();
  });

  it("skips LLM extraction for very short content", async () => {
    const service = new WebScraperService();
    vi.spyOn(service, "scrape").mockResolvedValue({
      url: "https://example.com",
      title: "Tiny Page",
      h1_tags: ["Tiny"],
      main_content: "Too short for reliable extraction.",
      relevance_score: 10,
    });

    const complete = vi.fn();
    const result = await service.scrapeWithEntityExtraction({
      url: "https://example.com",
      tenantId: "tenant-123",
      llmGateway: { complete },
      maxRetries: 1,
    });

    expect(complete).not.toHaveBeenCalled();
    expect(result?.entity_extraction?.entities).toEqual([]);
  });
});

