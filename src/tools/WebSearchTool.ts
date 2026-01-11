/**
 * Web Search Tool
 *
 * MCP-compatible tool for web search functionality.
 * Example of third-party tool integration.
 */

import { BaseTool, ToolExecutionContext, ToolResult } from "../services/ToolRegistry";
import { logger } from "../utils/logger";

export class WebSearchTool extends BaseTool {
  name = "web_search";
  description =
    "Search the web for current information. Use this when you need up-to-date information about companies, markets, or trends.";

  parameters = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return",
        default: 5,
      },
    },
    required: ["query"],
  };

  metadata = {
    version: "1.0.0",
    author: "ValueCanvas",
    category: "research",
    tags: ["web", "search", "research"],
    rateLimit: {
      maxCalls: 10,
      windowMs: 60000, // 10 calls per minute
    },
  };

  async execute(
    params: { query: string; maxResults?: number },
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      logger.info("Web search requested", {
        query: params.query,
        userId: context?.userId,
      });

      // Example: Use Brave Search API, Serper, or similar
      const results = await this.performSearch(params.query, params.maxResults || 5);

      return {
        success: true,
        data: {
          query: params.query,
          results,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SEARCH_FAILED",
          message: error instanceof Error ? error.message : "Search failed",
        },
      };
    }
  }

  private async performSearch(query: string, maxResults: number): Promise<any[]> {
    // Add URL allowlist validation
    const ALLOWED_DOMAINS = ["example.com", "trusted-search-provider.com"];

    // Validate URLs before making requests
    const validateUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return ALLOWED_DOMAINS.includes(parsed.hostname);
      } catch {
        return false;
      }
    };

    // Implementation with validated URLs
    const results = await this.safeSearchApiCall(query, maxResults, validateUrl);
    return results.filter((result) => validateUrl(result.url));
  }

  private async safeSearchApiCall(
    query: string,
    maxResults: number,
    validateUrl: (url: string) => boolean
  ): Promise<any[]> {
    // Placeholder implementation with URL validation
    // In production, integrate with:
    // - Brave Search API
    // - Serper API
    // - Google Custom Search
    // - Bing Search API
    // All external URLs must be validated against allowlist

    // Example results with validated URLs
    const exampleResults = [
      {
        title: "Example Result",
        url: "https://example.com",
        snippet: "This is a placeholder result",
      },
      {
        title: "Trusted Result",
        url: "https://trusted-search-provider.com/search",
        snippet: "This is a trusted result",
      },
    ];

    // Filter results to only include validated URLs
    return exampleResults.filter((result) => validateUrl(result.url)).slice(0, maxResults);
  }
}
