/**
 * MCP Ground Truth Service
 * 
 * Singleton service that provides access to the MCP Financial Ground Truth Server.
 * Used by agents to fetch authoritative financial data before generating responses.
 */

import { logger } from '../lib/logger';

// MCP Server type (dynamic import to avoid circular deps)
interface MCPServer {
  executeTool(toolName: string, args: Record<string, any>): Promise<{
    content: Array<{ type: string; text?: string; resource?: any }>;
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
      const { createDevServer } = await import('../mcp-ground-truth');
      this.server = await createDevServer();
      this.initialized = true;
      logger.info('MCP Ground Truth Server initialized');
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
  private parseToolResult(result: { content: Array<{ text?: string }>; isError?: boolean }): any {
    if (result.isError) return null;
    const textContent = result.content.find(c => c.text);
    if (!textContent?.text) return null;
    try {
      return JSON.parse(textContent.text);
    } catch {
      return null;
    }
  }

  /**
   * Get authoritative financial data for an entity
   */
  async getFinancialData(request: FinancialDataRequest): Promise<FinancialDataResult | null> {
    await this.initialize();

    if (!this.server) {
      logger.warn('MCP server not available, returning null');
      return null;
    }

    try {
      const result = await this.server.executeTool('get_authoritative_financials', {
        entity_id: request.entityId,
        metrics: request.metrics || ['revenue', 'netIncome', 'totalAssets', 'operatingIncome'],
        period: request.period || 'latest',
        include_benchmarks: request.includeIndustryBenchmarks ?? true,
      });

      const data = this.parseToolResult(result);
      if (!data) {
        logger.warn('MCP query failed or returned no data');
        return null;
      }

      return this.transformResult(data, request);
    } catch (error) {
      logger.error('Error fetching financial data', error instanceof Error ? error : undefined);
      return null;
    }
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

    if (!this.server) {
      return { verified: false, confidence: 0 };
    }

    try {
      const result = await this.server.executeTool('verify_claim_aletheia', {
        claim_text: `${claim.metric} is ${claim.value}`,
        context_entity: claim.entityId,
        context_date: claim.period || new Date().toISOString(),
      });

      const data = this.parseToolResult(result);
      if (!data) {
        return { verified: false, confidence: 0 };
      }

      return {
        verified: data.verified ?? false,
        actualValue: data.actual_value,
        deviation: data.deviation_percentage,
        source: data.source,
        confidence: data.confidence ?? 0,
      };
    } catch (error) {
      logger.error('Error verifying claim', error instanceof Error ? error : undefined);
      return { verified: false, confidence: 0 };
    }
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

    if (!this.server) {
      return null;
    }

    try {
      const result = await this.server.executeTool('populate_value_driver_tree', {
        target_cik: '',
        benchmark_naics: industryCode,
        driver_node_id: 'productivity_delta',
      });

      const data = this.parseToolResult(result);
      return data?.benchmarks || null;
    } catch (error) {
      logger.error('Error fetching benchmarks', error instanceof Error ? error : undefined);
      return null;
    }
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

    for (const entityId of entities.slice(0, 3)) { // Limit to 3 entities
      const data = await this.getFinancialData({
        entityId,
        metrics: ['revenue', 'netIncome', 'operatingMargin', 'totalAssets'],
        includeIndustryBenchmarks: true,
      });

      if (data) {
        dataPoints.push(this.formatDataForContext(data));
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

  private transformResult(data: any, request: FinancialDataRequest): FinancialDataResult {
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
