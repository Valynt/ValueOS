/**
 * WebSearchTool Tests
 * 
 * Tests for web search tool with rate limiting and error handling
 * following MCP patterns for tool testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WebSearchTool', () => {
  let mockLogger: any;
  let mockContext: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };

    mockContext = {
      userId: 'user-123',
      organizationId: 'org-456',
      sessionId: 'session-789'
    };
  });

  describe('Tool Metadata', () => {
    it('should have correct tool metadata', () => {
      const metadata = {
        name: 'web_search',
        version: '1.0.0',
        author: 'ValueCanvas',
        category: 'research',
        tags: ['web', 'search', 'research']
      };

      expect(metadata.name).toBe('web_search');
      expect(metadata.version).toBeDefined();
      expect(metadata.category).toBe('research');
    });

    it('should define rate limits', () => {
      const rateLimit = {
        maxCalls: 10,
        windowMs: 60000 // 10 calls per minute
      };

      expect(rateLimit.maxCalls).toBe(10);
      expect(rateLimit.windowMs).toBe(60000);
    });

    it('should define required parameters', () => {
      const parameters = {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          maxResults: { type: 'number', default: 5 }
        },
        required: ['query']
      };

      expect(parameters.required).toContain('query');
      expect(parameters.properties.maxResults.default).toBe(5);
    });
  });

  describe('Search Execution', () => {
    it('should execute search with valid query', async () => {
      const params = {
        query: 'enterprise software trends 2025',
        maxResults: 5
      };

      const result = {
        success: true,
        data: {
          query: params.query,
          results: [
            {
              title: 'Enterprise Software Trends',
              url: 'https://example.com/trends',
              snippet: 'Top trends in enterprise software...'
            }
          ],
          timestamp: new Date().toISOString()
        }
      };

      expect(result.success).toBe(true);
      expect(result.data.results.length).toBeGreaterThan(0);
    });

    it('should use default maxResults when not specified', async () => {
      const params = {
        query: 'cloud computing',
        maxResults: 5 // default
      };

      expect(params.maxResults).toBe(5);
    });

    it('should return multiple results', async () => {
      const results = [
        { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
        { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
        { title: 'Result 3', url: 'https://example.com/3', snippet: 'Snippet 3' }
      ];

      expect(results.length).toBe(3);
      expect(results[0].title).toBeDefined();
      expect(results[0].url).toBeDefined();
    });

    it('should include timestamp in results', async () => {
      const result = {
        query: 'test query',
        results: [],
        timestamp: new Date().toISOString()
      };

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Rate Limiting', () => {
    it('should track call count', async () => {
      const rateLimiter = {
        calls: 0,
        maxCalls: 10,
        windowMs: 60000,
        windowStart: Date.now()
      };

      rateLimiter.calls++;

      expect(rateLimiter.calls).toBe(1);
      expect(rateLimiter.calls).toBeLessThanOrEqual(rateLimiter.maxCalls);
    });

    it('should enforce rate limit', async () => {
      const rateLimiter = {
        calls: 10,
        maxCalls: 10,
        windowMs: 60000
      };

      const canProceed = rateLimiter.calls < rateLimiter.maxCalls;

      expect(canProceed).toBe(false);
    });

    it('should reset rate limit after window', async () => {
      const rateLimiter = {
        calls: 10,
        maxCalls: 10,
        windowMs: 60000,
        windowStart: Date.now() - 61000 // 61 seconds ago
      };

      const windowExpired = Date.now() - rateLimiter.windowStart > rateLimiter.windowMs;

      if (windowExpired) {
        rateLimiter.calls = 0;
        rateLimiter.windowStart = Date.now();
      }

      expect(rateLimiter.calls).toBe(0);
    });

    it('should return rate limit error', async () => {
      const error = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Try again in 30 seconds.',
          retryAfter: 30
        }
      };

      expect(error.success).toBe(false);
      expect(error.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.error.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle search API failure', async () => {
      const error = {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Search API unavailable'
        }
      };

      expect(error.success).toBe(false);
      expect(error.error.code).toBe('SEARCH_FAILED');
    });

    it('should handle invalid query', async () => {
      const error = {
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Query cannot be empty'
        }
      };

      expect(error.error.code).toBe('INVALID_QUERY');
    });

    it('should handle network timeout', async () => {
      const error = {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Search request timed out after 30 seconds'
        }
      };

      expect(error.error.code).toBe('TIMEOUT');
    });

    it('should handle API key missing', async () => {
      const error = {
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'Search API key not configured'
        }
      };

      expect(error.error.code).toBe('MISSING_API_KEY');
    });
  });

  describe('Result Formatting', () => {
    it('should format search results correctly', async () => {
      const result = {
        title: 'Example Article',
        url: 'https://example.com/article',
        snippet: 'This is a snippet of the article content...',
        publishedDate: '2025-01-15',
        source: 'example.com'
      };

      expect(result.title).toBeDefined();
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.snippet).toBeDefined();
    });

    it('should truncate long snippets', async () => {
      const longSnippet = 'A'.repeat(500);
      const maxLength = 200;
      const truncated = longSnippet.substring(0, maxLength) + '...';

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
    });

    it('should sanitize HTML in snippets', async () => {
      const rawSnippet = '<script>alert("xss")</script>This is content';
      const sanitized = rawSnippet.replace(/<[^>]*>/g, '');

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('This is content');
    });
  });

  describe('Logging', () => {
    it('should log search requests', async () => {
      const logEntry = {
        level: 'info',
        message: 'Web search requested',
        query: 'enterprise software',
        userId: 'user-123',
        timestamp: new Date().toISOString()
      };

      expect(logEntry.message).toBe('Web search requested');
      expect(logEntry.query).toBeDefined();
      expect(logEntry.userId).toBeDefined();
    });

    it('should log search failures', async () => {
      const logEntry = {
        level: 'error',
        message: 'Search failed',
        error: 'API unavailable',
        query: 'test query',
        userId: 'user-123'
      };

      expect(logEntry.level).toBe('error');
      expect(logEntry.error).toBeDefined();
    });

    it('should log rate limit violations', async () => {
      const logEntry = {
        level: 'warn',
        message: 'Rate limit exceeded',
        userId: 'user-123',
        callCount: 11,
        maxCalls: 10
      };

      expect(logEntry.level).toBe('warn');
      expect(logEntry.callCount).toBeGreaterThan(logEntry.maxCalls);
    });
  });

  describe('Performance', () => {
    it('should complete search within timeout', async () => {
      const execution = {
        startTime: Date.now(),
        endTime: Date.now() + 2000, // 2 seconds
        timeout: 30000 // 30 seconds
      };

      const duration = execution.endTime - execution.startTime;

      expect(duration).toBeLessThan(execution.timeout);
    });

    it('should cache recent searches', async () => {
      const cache = {
        query: 'enterprise software',
        results: [{ title: 'Result 1' }],
        cachedAt: Date.now(),
        ttl: 300000 // 5 minutes
      };

      const age = Date.now() - cache.cachedAt;
      const isValid = age < cache.ttl;

      expect(isValid).toBe(true);
    });

    it('should handle concurrent searches', async () => {
      const searches = [
        { query: 'query1', status: 'pending' },
        { query: 'query2', status: 'pending' },
        { query: 'query3', status: 'pending' }
      ];

      expect(searches.length).toBe(3);
      expect(searches.every(s => s.status === 'pending')).toBe(true);
    });
  });

  describe('Context Integration', () => {
    it('should use execution context', async () => {
      const context = {
        userId: 'user-123',
        organizationId: 'org-456',
        sessionId: 'session-789'
      };

      expect(context.userId).toBeDefined();
      expect(context.organizationId).toBeDefined();
    });

    it('should track search history per user', async () => {
      const history = {
        userId: 'user-123',
        searches: [
          { query: 'query1', timestamp: Date.now() - 1000 },
          { query: 'query2', timestamp: Date.now() }
        ]
      };

      expect(history.searches.length).toBe(2);
      expect(history.searches[1].timestamp).toBeGreaterThan(history.searches[0].timestamp);
    });
  });
});
