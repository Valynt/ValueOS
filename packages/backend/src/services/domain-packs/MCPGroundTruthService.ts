/**
 * MCP Ground Truth Service
 * 
 * Singleton service that provides access to the MCP Financial Ground Truth Server.
 * Used by agents to fetch authoritative financial data before generating responses.
 */

import { getGroundtruthConfig, isBrowser } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { getRedisClient } from '../../lib/redisClient.js';
import { ExternalCircuitBreaker } from '../post-v1/ExternalCircuitBreaker.js';

// MCP Server type (dynamic import to avoid circular deps)
interface MCPServer {
  executeTool(toolName: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text?: string; resource?: unknown }>;
    isError?: boolean;
  }>;
}

// ============================================================================
// Types
// ============================================================================

export interface FinancialDataRequest {
  entityId: string;  // CIK or ticker
  metrics?: string[];  // e.g., ['revenue', 'netIncome', 'operatingMargin']
  period?: string;  // e.g., 'FY2024', 'Q3-2024'
  includeIndustryBenchmarks?: boolean;
}

export interface FinancialDataResult {
  entityName: string;
  entityId: string;
  period: string;
  metrics: Record<string, {
    value: number;
    unit: string;
    source: string;
    confidence: number;
    asOfDate: string;
  }>;
  industryBenchmarks?: Record<string, {
    median: number;
    p25: number;
    p75: number;
  }>;
  sources: string[];
}

// ============================================================================
// Service
// ============================================================================

class MCPGroundTruthService {
  private server: MCPServer | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly apiBasePath = '/api/groundtruth';
  private readonly circuitBreaker = new ExternalCircuitBreaker('groundtruth');
  private readonly breakerKeys = {
    financialsApi: 'external:groundtruth:financials',
    verifyApi: 'external:groundtruth:verify',
    benchmarksApi: 'external:groundtruth:benchmarks',
    resolveTickerApi: 'external:groundtruth:resolve_ticker',
    filingSectionsApi: 'external:groundtruth:filing_sections',
    financialsMcp: 'external:groundtruth:mcp:financials',
    verifyMcp: 'external:groundtruth:mcp:verify',
    benchmarksMcp: 'external:groundtruth:mcp:benchmarks',
  } as const;
  private readonly breakerConfig = {
    minimumSamples: 1,
    failureRateThreshold: 0.5,
  };

  /**
   * Initialize the MCP server (lazy, on first use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Dynamic import to avoid loading MCP code unless needed
      const { createDevServer } = await import('../../mcp-ground-truth');
      this.server = await createDevServer();
      this.initialized = true;
      if (this.server) {
        logger.info('MCP Ground Truth Server initialized');
      } else {
        logger.warn('MCP Ground Truth Server initialization returned null, falling back to HTTP');
      }
    } catch (error) {
      logger.error('Failed to initialize MCP server', error instanceof Error ? error : undefined);
      // Don't throw - service degrades gracefully
      this.initialized = true; // Mark as initialized to avoid retry loops
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.server !== null;
  }

  /**
   * Parse MCP tool result (content contains JSON string)
   */
  private parseToolResult(result: { content: Array<{ text?: string }>; isError?: boolean }): unknown {
    if (result.isError) return null;
    const textContent = result.content.find(c => c.text);
    if (!textContent?.text) return null;
    try {
      return JSON.parse(textContent.text);
    } catch {
      return null;
    }
  }

  private async callGroundtruthApi<T>(
    operation: 'financialsApi' | 'verifyApi' | 'benchmarksApi' | 'resolveTickerApi' | 'filingSectionsApi',
    payload: Record<string, unknown>
  ): Promise<T | null> {
    const breakerKey = this.breakerKeys[operation];
    let path = operation.replace('Api', '');
    
    // Map operation to endpoint path
    const pathMap: Record<string, string> = {
      financials: 'financials',
      verify: 'verify',
      benchmarks: 'benchmarks',
      resolveTicker: 'resolve-ticker',
      filingSections: 'filing-sections'
    };
    path = pathMap[path] || path;

    return this.circuitBreaker.execute(
      breakerKey,
      async () => {
        const config = getGroundtruthConfig();
        const url = isBrowser() 
          ? `${this.apiBasePath}/${path}`
          : `${config.baseUrl.replace(/\/$/, '')}/${path}`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.apiKey && !isBrowser()) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
          headers['x-api-key'] = config.apiKey;
        }

        // eslint-disable-next-line no-restricted-globals -- legitimate direct fetch usage
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Groundtruth API error (${operation}): ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        // The API returns { success: true, data: ... }
        if (!data?.success && !isBrowser()) {
          throw new Error(`Groundtruth API unsuccessful (${operation}): ${data?.error || data?.message || 'unknown'}`);
        }

        return (isBrowser() ? data : data.data) as T;
      },
      {
        config: this.breakerConfig,
        fallback: async (error, state) => {
          logger.warn('Groundtruth circuit breaker fallback activated', {
            integration: 'groundtruth',
            operation,
            breakerKey,
            breakerState: state,
            circuitOpen: state === 'open',
            error: error.message,
          });
          return null;
        },
      }
    );
  }

  private normalizeGroundTruthError(error: unknown): Error & { transient: boolean; kind: 'transient' | 'permanent' } {
    const rawError = error instanceof Error ? error : new Error('Unknown MCP GroundTruth error');
    const message = rawError.message.toLowerCase();
    const transientIndicators = [
      'timeout',
      'timed out',
      'econnreset',
      'econnrefused',
      'rate limit',
      '429',
      '503',
      '502',
      '504',
      'network',
      'circuit breaker',
    ];
    const permanentIndicators = ['400', '401', '403', '404', 'validation', 'invalid', 'malformed'];

    const transient = transientIndicators.some(token => message.includes(token));
    const permanent = permanentIndicators.some(token => message.includes(token));
    const kind = transient || !permanent ? 'transient' : 'permanent';

    const normalized = new Error(rawError.message) as Error & { transient: boolean; kind: 'transient' | 'permanent' };
    normalized.name = rawError.name;
    normalized.stack = rawError.stack;
    normalized.transient = kind === 'transient';
    normalized.kind = kind;
    return normalized;
  }

  public async callMcpTool<T>(
    operation: 'financialsMcp' | 'verifyMcp' | 'benchmarksMcp',
    toolName: string,
    args: Record<string, unknown>,
    transform: (data: unknown) => T | null
  ): Promise<T | null> {
    await this.initialize();
    
    if (!this.server) {
      // Fallback to HTTP if server not available and it's a known tool
      if (toolName === 'get_authoritative_financials') {
        return this.callGroundtruthApi<T>('financialsApi', {
          entityId: args.entity_id,
          metrics: args.metrics,
          period: args.period
        });
      }
      if (toolName === 'resolve_ticker_from_domain') {
        return this.resolveTickerFromDomain(args as { domain: string }) as unknown as T;
      }
      if (toolName === 'get_filing_sections') {
        return this.getFilingSections(args as { identifier: string; filingType?: '10-K' | '10-Q'; sections: string[] }) as unknown as T;
      }

      logger.warn('MCP server not available and no HTTP fallback for tool, returning null', { operation, toolName });
      return null;
    }

    const breakerKey = this.breakerKeys[operation];
    return this.circuitBreaker.execute(
      breakerKey,
      async () => {
        try {
          const result = await this.server!.executeTool(toolName, args);
          const data = this.parseToolResult(result);
          if (!data) {
            throw new Error(`MCP tool returned empty result (${toolName})`);
          }

          const transformed = transform(data);
          if (!transformed) {
            throw new Error(`MCP tool transform failed (${toolName})`);
          }

          return transformed;
        } catch (error) {
          const normalizedError = this.normalizeGroundTruthError(error);
          logger.warn('MCP tool execution failed', {
            operation,
            toolName,
            error: normalizedError.message,
            errorKind: normalizedError.kind,
          });

          if (!normalizedError.transient) {
            logger.warn('MCP tool encountered non-transient error; bypassing breaker trip', {
              operation,
              toolName,
              error: normalizedError.message,
            });
            return null;
          }

          throw normalizedError;
        }
      },
      {
        config: this.breakerConfig,
        fallback: async (error, state) => {
          logger.warn('Groundtruth MCP circuit breaker fallback activated', {
            integration: 'groundtruth',
            operation,
            toolName,
            breakerKey,
            breakerState: state,
            circuitOpen: state === 'open',
            error: error.message,
          });
          return null;
        },
      }
    );
  }

  /**
   * Get authoritative financial data for an entity
   */
  async getFinancialData(request: FinancialDataRequest): Promise<FinancialDataResult | null> {
    await this.initialize();

    if (this.server) {
      return this.callMcpTool('financialsMcp', 'get_authoritative_financials', {
        entity_id: request.entityId,
        metrics: request.metrics || ['revenue', 'netIncome', 'totalAssets', 'operatingIncome'],
        period: request.period || 'latest',
        include_benchmarks: request.includeIndustryBenchmarks ?? true,
      }, data => this.transformResult(data, request));
    }

    return this.callGroundtruthApi<FinancialDataResult>('financialsApi', {
      entityId: request.entityId,
      metrics: request.metrics,
      period: request.period,
      includeIndustryBenchmarks: request.includeIndustryBenchmarks,
    });
  }

  /**
   * Resolve a corporate domain to a public ticker
   */
  async resolveTickerFromDomain(request: { domain: string }): Promise<{
    ticker: string;
    confidence: number;
    domain: string;
  } | null> {
    await this.initialize();

    if (this.server) {
      return this.callMcpTool('financialsMcp', 'resolve_ticker_from_domain', {
        domain: request.domain
      }, data => ({
        ticker: data.ticker,
        confidence: data.confidence,
        domain: data.domain
      }));
    }

    return this.callGroundtruthApi<{
      ticker: string;
      confidence: number;
      domain: string;
    }>('resolveTickerApi', {
      domain: request.domain
    });
  }

  /**
   * Verify a financial claim against authoritative sources
   */
  async verifyClaim(claim: {
    entityId: string;
    metric: string;
    value: number;
    period?: string;
  }): Promise<{
    verified: boolean;
    actualValue?: number;
    deviation?: number;
    source?: string;
    confidence: number;
  }> {
    await this.initialize();

    if (this.server) {
      const response = await this.callMcpTool('verifyMcp', 'verify_claim_aletheia', {
        claim_text: `${claim.metric} is ${claim.value}`,
        context_entity: claim.entityId,
        context_date: claim.period || new Date().toISOString(),
      }, data => ({
        verified: data.verified ?? false,
        actualValue: data.actual_value,
        deviation: data.deviation_percentage,
        source: data.source,
        confidence: data.confidence ?? 0,
      }));

      return response ?? { verified: false, confidence: 0 };
    }

    const response = await this.callGroundtruthApi<{
      verified: boolean;
      actualValue?: number;
      deviation?: number;
      source?: string;
      confidence: number;
    }>('verifyApi', {
      entityId: claim.entityId,
      metric: claim.metric,
      value: claim.value,
      period: claim.period,
    });

    return response ?? { verified: false, confidence: 0 };
  }

  /**
   * Get industry benchmarks for comparison
   */
  async getIndustryBenchmarks(industryCode: string, metrics: string[]): Promise<Record<string, {
    median: number;
    p25: number;
    p75: number;
    sampleSize: number;
  }> | null> {
    await this.initialize();

    if (this.server) {
      return this.callMcpTool('benchmarksMcp', 'populate_value_driver_tree', {
        target_cik: '',
        benchmark_naics: industryCode,
        driver_node_id: 'productivity_delta',
      }, data => data?.benchmarks || null);
    }

    return this.callGroundtruthApi<Record<string, {
      median: number;
      p25: number;
      p75: number;
      sampleSize: number;
    }>>('benchmarksApi', {
      industryCode,
      metrics,
    });
  }

  /**
   * Get specific sections from SEC filings (R1.1)
   */
  async getFilingSections(request: {
    identifier: string;
    filingType?: '10-K' | '10-Q';
    sections: string[];
  }): Promise<Record<string, string> | null> {
    await this.initialize();

    // Cache EDGAR filing sections for 24 hours — filings are immutable once
    // published, so a long TTL is safe and avoids redundant SEC API calls.
    const cacheKey = `edgar:filing:${request.identifier}:${request.filingType ?? '10-K'}:${request.sections.sort().join(',')}`;
    const EDGAR_CACHE_TTL_SECONDS = 24 * 60 * 60;

    try {
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as Record<string, string>;
        }
      }

      let result: Record<string, string> | null = null;

      if (this.server) {
        result = await this.callMcpTool('financialsMcp', 'get_filing_sections', {
          identifier: request.identifier,
          filing_type: request.filingType || '10-K',
          sections: request.sections,
        }, data => data?.sections || null);
      } else {
        result = await this.callGroundtruthApi<Record<string, string>>('filingSectionsApi', {
          identifier: request.identifier,
          filingType: request.filingType,
          sections: request.sections,
        });
      }

      if (result && redis) {
        await redis.set(cacheKey, JSON.stringify(result), { EX: EDGAR_CACHE_TTL_SECONDS });
      }

      return result;
    } catch (cacheErr) {
      // Cache failure is non-fatal — fall through to live fetch
      logger.warn('EDGAR cache error — fetching live', {
        identifier: request.identifier,
        error: (cacheErr as Error).message,
      });

      if (this.server) {
        return this.callMcpTool('financialsMcp', 'get_filing_sections', {
          identifier: request.identifier,
          filing_type: request.filingType || '10-K',
          sections: request.sections,
        }, data => data?.sections || null);
      }

      return this.callGroundtruthApi<Record<string, string>>('filingSectionsApi', {
        identifier: request.identifier,
        filingType: request.filingType,
        sections: request.sections,
      });
    }
  }

  getCircuitBreakerMetrics(): Record<string, ReturnType<ExternalCircuitBreaker["getMetrics"]>> {
    return {
      [this.breakerKeys.financialsApi]: this.circuitBreaker.getMetrics(this.breakerKeys.financialsApi),
      [this.breakerKeys.verifyApi]: this.circuitBreaker.getMetrics(this.breakerKeys.verifyApi),
      [this.breakerKeys.benchmarksApi]: this.circuitBreaker.getMetrics(this.breakerKeys.benchmarksApi),
      [this.breakerKeys.financialsMcp]: this.circuitBreaker.getMetrics(this.breakerKeys.financialsMcp),
      [this.breakerKeys.verifyMcp]: this.circuitBreaker.getMetrics(this.breakerKeys.verifyMcp),
      [this.breakerKeys.benchmarksMcp]: this.circuitBreaker.getMetrics(this.breakerKeys.benchmarksMcp),
    };
  }

  /**
   * Enrich a query with ground truth data context
   * Call this before sending to LLM to provide factual grounding
   */
  async enrichQueryWithGroundTruth(
    query: string,
    entities: string[]
  ): Promise<string> {
    if (entities.length === 0) {
      return '';
    }

    const dataPoints: string[] = [];
    const entityResults = await Promise.allSettled(
      entities.slice(0, 3).map(entityId => // Limit to 3 entities
        this.getFinancialData({
          entityId,
          metrics: ['revenue', 'netIncome', 'operatingMargin', 'totalAssets'],
          includeIndustryBenchmarks: true,
        })
      )
    );

    for (const result of entityResults) {
      if (result.status === 'fulfilled' && result.value) {
        dataPoints.push(this.formatDataForContext(result.value));
      }
    }

    if (dataPoints.length === 0) {
      return '';
    }

    return `
## Authoritative Financial Data (from SEC filings)
${dataPoints.join('\n\n')}

Use these verified figures in your analysis. Do not hallucinate different numbers.
`;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private transformResult(data: unknown, request: FinancialDataRequest): FinancialDataResult {
    return {
      entityName: data.entity_name || request.entityId,
      entityId: request.entityId,
      period: data.period || request.period || 'latest',
      metrics: data.metrics || {},
      industryBenchmarks: data.benchmarks,
      sources: data.sources || [],
    };
  }

  private formatDataForContext(data: FinancialDataResult): string {
    const lines = [`### ${data.entityName} (${data.period})`];
    
    for (const [metric, info] of Object.entries(data.metrics)) {
      const value = typeof info.value === 'number' 
        ? info.value >= 1000000 
          ? `$${(info.value / 1000000).toFixed(1)}M`
          : `$${info.value.toLocaleString()}`
        : info.value;
      lines.push(`- **${metric}**: ${value} (source: ${info.source}, confidence: ${Math.round(info.confidence * 100)}%)`);
    }

    if (data.industryBenchmarks) {
      lines.push('\nIndustry Benchmarks:');
      for (const [metric, bench] of Object.entries(data.industryBenchmarks)) {
        lines.push(`- ${metric}: median ${bench.median}, range [${bench.p25} - ${bench.p75}]`);
      }
    }

    return lines.join('\n');
  }
}

// Singleton export
export const mcpGroundTruthService = new MCPGroundTruthService();
