/**
 * Web Search Tool
 *
 * MCP-compatible tool for web search functionality.
 * Example of third-party tool integration.
 */

import {
  BaseTool,
  ToolExecutionContext,
  ToolResult,
} from "../services/ToolRegistry";
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
      const results = await this.performSearch(
        params.query,
        params.maxResults || 5
      );

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

  private async performSearch(
    query: string,
    maxResults: number
  ): Promise<any[]> {
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
    const results = await this.safeSearchApiCall(
      query,
      maxResults,
      validateUrl
    );
    return results.filter((result) => validateUrl(result.url));
  }

  private async safeSearchApiCall(
    query: string,
    maxResults: number,
    validateUrl: (url: string) => boolean
  ): Promise<any[]> {
    // Try multiple search providers in order of preference
    const providers = [
      () => this.searchWithBrave(query, maxResults),
      () => this.searchWithSerper(query, maxResults),
      () => this.searchWithGoogle(query, maxResults),
    ];

    for (const provider of providers) {
      try {
        const results = await provider();
        if (results && results.length > 0) {
          return results
            .filter((result: any) => validateUrl(result.url))
            .slice(0, maxResults);
        }
      } catch (error) {
        logger.warn(`Search provider failed, trying next: ${error}`);
        continue;
      }
    }

    // Fallback to placeholder if all providers fail
    logger.warn("All search providers failed, using placeholder results");
    const exampleResults = [
      {
        title: "Search Unavailable",
        url: "https://example.com/search-unavailable",
        snippet:
          "Search services are currently unavailable. Please try again later.",
      },
    ];

    return exampleResults
      .filter((result) => validateUrl(result.url))
      .slice(0, maxResults);
  }

  private async searchWithBrave(
    query: string,
    maxResults: number
  ): Promise<any[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error("Brave Search API key not configured");
    }

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.web?.results) {
      return [];
    }

    return data.web.results.map((result: any) => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
    }));
  }

  private async searchWithSerper(
    query: string,
    maxResults: number
  ): Promise<any[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error("Serper API key not configured");
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.organic) {
      return [];
    }

    return data.organic.map((result: any) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
    }));
  }

  private async searchWithGoogle(
    query: string,
    maxResults: number
  ): Promise<any[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error("Google Search API credentials not configured");
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${maxResults}`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  }
}
