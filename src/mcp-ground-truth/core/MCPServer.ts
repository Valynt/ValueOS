/**
 * MCP Financial Ground Truth Server
 * 
 * Model Context Protocol (MCP) server implementation for financial data retrieval.
 * Exposes standardized tools for LLM agents to query authoritative financial data
 * with zero-hallucination guarantees.
 * 
 * MCP Specification: v1.0
 * Security Level: IL4 (Impact Level 4 - Controlled Unclassified Information)
 * 
 * Implements tools:
 * - get_authoritative_financials (Tier 1)
 * - get_private_entity_estimates (Tier 2)
 * - verify_claim_aletheia (Verification)
 * - populate_value_driver_tree (Value Engineering)
 */

import { UnifiedTruthLayer } from './UnifiedTruthLayer';
import { EDGARModule } from '../modules/EDGARModule';
import { XBRLModule } from '../modules/XBRLModule';
import { MarketDataModule } from '../modules/MarketDataModule';
import { PrivateCompanyModule } from '../modules/PrivateCompanyModule';
import { IndustryBenchmarkModule } from '../modules/IndustryBenchmarkModule';
import { GroundTruthError, ErrorCodes } from '../types';
import { logger } from '../../utils/logger';

interface MCPServerConfig {
  // Module configurations
  edgar: {
    userAgent: string;
    rateLimit?: number;
  };
  xbrl: {
    userAgent: string;
    rateLimit?: number;
  };
  marketData: {
    provider: 'alphavantage' | 'polygon' | 'tiingo';
    apiKey: string;
    rateLimit?: number;
  };
  privateCompany: {
    crunchbaseApiKey?: string;
    zoomInfoApiKey?: string;
    linkedInApiKey?: string;
    enableWebScraping?: boolean;
  };
  industryBenchmark: {
    blsApiKey?: string;
    censusApiKey?: string;
    enableStaticData?: boolean;
  };
  
  // Truth layer configuration
  truthLayer: {
    enableFallback?: boolean;
    strictMode?: boolean;
    maxResolutionTime?: number;
    parallelQuery?: boolean;
  };
  
  // Security configuration
  security: {
    enableWhitelist?: boolean;
    enableRateLimiting?: boolean;
    enableAuditLogging?: boolean;
  };
}

/**
 * MCP Tool Definition
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * MCP Tool Result
 */
interface MCPToolResult {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: any;
  }>;
  isError?: boolean;
}

/**
 * MCP Financial Ground Truth Server
 * 
 * Main server class that implements the Model Context Protocol
 * for financial data retrieval.
 */
export class MCPFinancialGroundTruthServer {
  private truthLayer: UnifiedTruthLayer;
  private modules: {
    edgar?: EDGARModule;
    xbrl?: XBRLModule;
    marketData?: MarketDataModule;
    privateCompany?: PrivateCompanyModule;
    industryBenchmark?: IndustryBenchmarkModule;
  } = {};
  
  private config: MCPServerConfig;
  private initialized = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.truthLayer = new UnifiedTruthLayer(config.truthLayer);
  }

  /**
   * Initialize the MCP server and all modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('MCP server already initialized');
      return;
    }

    logger.info('Initializing MCP Financial Ground Truth Server');

    try {
      // Initialize EDGAR module (Tier 1)
      this.modules.edgar = new EDGARModule();
      await this.modules.edgar.initialize(this.config.edgar);
      this.truthLayer.registerModule(this.modules.edgar);

      // Initialize XBRL module (Tier 1)
      this.modules.xbrl = new XBRLModule();
      await this.modules.xbrl.initialize(this.config.xbrl);
      this.truthLayer.registerModule(this.modules.xbrl);

      // Initialize Market Data module (Tier 2)
      this.modules.marketData = new MarketDataModule();
      await this.modules.marketData.initialize(this.config.marketData);
      this.truthLayer.registerModule(this.modules.marketData);

      // Initialize Private Company module (Tier 2)
      this.modules.privateCompany = new PrivateCompanyModule();
      await this.modules.privateCompany.initialize(this.config.privateCompany);
      this.truthLayer.registerModule(this.modules.privateCompany);

      // Initialize Industry Benchmark module (Tier 3)
      this.modules.industryBenchmark = new IndustryBenchmarkModule();
      await this.modules.industryBenchmark.initialize(this.config.industryBenchmark);
      this.truthLayer.registerModule(this.modules.industryBenchmark);

      this.initialized = true;
      logger.info('MCP Financial Ground Truth Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get list of available MCP tools
   */
  getTools(): MCPTool[] {
    return [
      {
        name: 'get_authoritative_financials',
        description: 'Retrieves strict Tier 1 GAAP financial data from SEC EDGAR filings (10-K/10-Q). Use this for all public company historical analysis. Returns deterministic values with provenance.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'The CIK (Central Index Key) or Ticker symbol. CIK is preferred to avoid collision.',
              pattern: '^[A-Z0-9]{1,10}$',
            },
            period: {
              type: 'string',
              description: 'Fiscal period normalized to Calendar Quarters or Annual format.',
              enum: ['FY2023', 'FY2024', 'CQ1_2024', 'CQ2_2024', 'LTM'],
            },
            metrics: {
              type: 'array',
              description: 'List of standardized GAAP taxonomy tags requested.',
              items: {
                type: 'string',
                enum: [
                  'revenue_total',
                  'gross_profit',
                  'operating_income',
                  'net_income',
                  'eps_diluted',
                  'cash_and_equivalents',
                  'total_debt',
                ],
              },
              minItems: 1,
            },
            currency: {
              type: 'string',
              description: 'ISO 4217 currency code. Defaults to reporting currency if omitted.',
              default: 'USD',
              pattern: '^[A-Z]{3}$',
            },
          },
          required: ['entity_id', 'metrics'],
        },
      },
      {
        name: 'get_private_entity_estimates',
        description: 'Generates financial estimates for private entities using proxy data (Headcount, Industry Benchmarks). Use ONLY when Tier 1 data is unavailable.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Corporate domain name for entity resolution.',
              format: 'hostname',
            },
            proxy_metric: {
              type: 'string',
              description: 'The base metric used for estimation derivation.',
              enum: ['headcount_linkedin', 'web_traffic', 'funding_stage'],
              default: 'headcount_linkedin',
            },
            industry_code: {
              type: 'string',
              description: 'NAICS or SIC code to select appropriate productivity benchmarks.',
            },
          },
          required: ['domain'],
        },
      },
      {
        name: 'verify_claim_aletheia',
        description: 'Cross-references a specific natural language claim against the Ground Truth database. Returns a boolean verification status and evidence snippet.',
        inputSchema: {
          type: 'object',
          properties: {
            claim_text: {
              type: 'string',
              description: 'The sentence or assertion containing a financial fact to verify.',
            },
            context_entity: {
              type: 'string',
              description: 'CIK or Name of the entity in question.',
            },
            context_date: {
              type: 'string',
              description: 'ISO 8601 date string for the point-in-time of the claim.',
            },
            strict_mode: {
              type: 'boolean',
              description: 'If true, requires Tier 1 source for verification. If false, accepts Tier 2.',
              default: true,
            },
          },
          required: ['claim_text', 'context_entity'],
        },
      },
      {
        name: 'populate_value_driver_tree',
        description: 'Calculates productivity deltas and populates a specific Value Driver Tree node based on benchmark comparisons.',
        inputSchema: {
          type: 'object',
          properties: {
            target_cik: {
              type: 'string',
              description: 'The target company to analyze.',
            },
            benchmark_naics: {
              type: 'string',
              description: 'The industry peer group for comparison.',
            },
            driver_node_id: {
              type: 'string',
              description: 'ID of the value tree node to populate.',
              enum: ['revenue_uplift', 'cost_reduction', 'risk_mitigation', 'productivity_delta'],
            },
            simulation_period: {
              type: 'string',
              description: 'The forward-looking period for the value realization model.',
            },
          },
          required: ['target_cik', 'benchmark_naics', 'driver_node_id'],
        },
      },
    ];
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<MCPToolResult> {
    if (!this.initialized) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        'MCP server not initialized'
      );
    }

    logger.info('MCP tool execution started', { toolName, args });

    try {
      switch (toolName) {
        case 'get_authoritative_financials':
          return await this.getAuthoritativeFinancials(args);
        
        case 'get_private_entity_estimates':
          return await this.getPrivateEntityEstimates(args);
        
        case 'verify_claim_aletheia':
          return await this.verifyClaimAletheia(args);
        
        case 'populate_value_driver_tree':
          return await this.populateValueDriverTree(args);
        
        default:
          throw new GroundTruthError(
            ErrorCodes.INVALID_REQUEST,
            `Unknown tool: ${toolName}`
          );
      }
    } catch (error) {
      logger.error('MCP tool execution failed', {
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: {
              code: error instanceof GroundTruthError ? error.code : ErrorCodes.UPSTREAM_FAILURE,
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  /**
   * Tool: get_authoritative_financials
   */
  private async getAuthoritativeFinancials(args: {
    entity_id: string;
    period?: string;
    metrics: string[];
    currency?: string;
  }): Promise<MCPToolResult> {
    const { entity_id, period, metrics, currency = 'USD' } = args;

    // Resolve each metric
    const results = await this.truthLayer.resolveMultiple(
      metrics.map(metric => ({
        identifier: entity_id,
        metric,
        period,
        prefer_tier: 'tier1',
        fallback_enabled: false, // Strict Tier 1 only
      }))
    );

    // Format response according to MCP standard
    const response = {
      data: results.map(r => ({
        entity: {
          name: r.metric.metadata.company_name || entity_id,
          cik: entity_id,
        },
        metric: r.metric.metric_name,
        value: r.metric.value,
        unit: currency,
        period: r.metric.provenance.period,
      })),
      metadata: results.map(r => ({
        source_tier: 1,
        source_name: r.metric.source,
        filing_type: r.metric.provenance.filing_type,
        accession_number: r.metric.provenance.accession_number,
        filing_date: r.metric.metadata.filing_date,
        extraction_confidence: r.metric.confidence,
      })),
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        verification_hash: this.generateVerificationHash(results),
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Tool: get_private_entity_estimates
   */
  private async getPrivateEntityEstimates(args: {
    domain: string;
    proxy_metric?: string;
    industry_code?: string;
  }): Promise<MCPToolResult> {
    const { domain, proxy_metric = 'headcount_linkedin', industry_code } = args;

    const result = await this.truthLayer.resolve({
      identifier: domain,
      metric: 'revenue_estimate',
      prefer_tier: 'tier2',
      fallback_enabled: false,
    });

    const response = {
      data: {
        domain,
        metric: result.metric.metric_name,
        value: result.metric.value,
        confidence_score: result.metric.confidence,
        rationale: result.metric.metadata.rationale,
      },
      metadata: {
        source_tier: 2,
        estimation_method: result.metric.metadata.estimation_method,
        proxy_metric,
        industry_code,
        quality_factors: result.metric.metadata.quality_factors,
      },
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Tool: verify_claim_aletheia
   */
  private async verifyClaimAletheia(args: {
    claim_text: string;
    context_entity: string;
    context_date?: string;
    strict_mode?: boolean;
  }): Promise<MCPToolResult> {
    const {
      claim_text,
      context_entity,
      context_date,
      strict_mode = true,
    } = args;

    const verification = await this.truthLayer.verifyClaim(
      claim_text,
      context_entity,
      context_date,
      strict_mode
    );

    const response = {
      verified: verification.verified,
      confidence: verification.confidence,
      evidence: verification.evidence ? {
        metric: verification.evidence.metric_name,
        value: verification.evidence.value,
        source: verification.evidence.source,
        tier: verification.evidence.tier,
      } : undefined,
      discrepancy: verification.discrepancy,
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        claim_text,
        context_entity,
        strict_mode,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Tool: populate_value_driver_tree
   */
  private async populateValueDriverTree(args: {
    target_cik: string;
    benchmark_naics: string;
    driver_node_id: string;
    simulation_period: string;
  }): Promise<MCPToolResult> {
    const {
      target_cik,
      benchmark_naics,
      driver_node_id,
      simulation_period,
    } = args;

    const result = await this.truthLayer.populateValueDriverTree(
      target_cik,
      benchmark_naics,
      driver_node_id,
      simulation_period
    );

    const response = {
      node_id: result.node_id,
      value: result.value,
      rationale: result.rationale,
      confidence: result.confidence,
      supporting_data: result.supporting_data.map(m => ({
        metric: m.metric_name,
        value: m.value,
        source: m.source,
        tier: m.tier,
      })),
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        target_cik,
        benchmark_naics,
        simulation_period,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const health = await this.truthLayer.healthCheck();
    
    return {
      status: health.healthy ? 'healthy' : 'degraded',
      details: {
        initialized: this.initialized,
        modules: health.modules,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateVerificationHash(results: any[]): string {
    // Simple hash generation for verification
    const data = JSON.stringify(results);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16)}`;
  }
}
