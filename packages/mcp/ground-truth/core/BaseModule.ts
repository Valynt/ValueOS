/**
 * Base Module Implementation
 *
 * Abstract base class for all Ground Truth modules with common functionality
 * for caching, rate limiting, error handling, and provenance tracking.
 */

import { createHash } from 'crypto';

import { logger } from '../../lib/logger';
import { MemoryCache, getCache } from './Cache';
import {
  ConfidenceTier,
  ErrorCodes,
  FinancialMetric,
  GroundTruthError,
  GroundTruthModule,
  ModuleRequest,
  ModuleResponse,
  ProvenanceInfo,
} from '../types';

export abstract class BaseModule implements GroundTruthModule {
  abstract name: string;
  abstract tier: ConfidenceTier;
  abstract description: string;

  protected config: Record<string, any> = {};
  protected initialized = false;
  protected requestCount = 0;
  protected lastRequestTime = 0;
  protected cache: MemoryCache = getCache();

  async initialize(config: Record<string, any>): Promise<void> {
    this.config = config;
    this.initialized = true;
    logger.info(`Module ${this.name} initialized`, { tier: this.tier });
  }

  abstract query(request: ModuleRequest): Promise<ModuleResponse>;
  abstract canHandle(request: ModuleRequest): boolean;

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    return {
      healthy: this.initialized,
      details: {
        name: this.name,
        tier: this.tier,
        requestCount: this.requestCount,
        lastRequestTime: this.lastRequestTime,
      },
    };
  }

  /**
   * Execute query with timing, error handling, and logging
   */
  protected async executeWithMetrics(
    request: ModuleRequest,
    queryFn: () => Promise<FinancialMetric | FinancialMetric[]>
  ): Promise<ModuleResponse> {
    const startTime = Date.now();
    this.requestCount++;
    this.lastRequestTime = startTime;

    try {
      if (!this.initialized) {
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Module ${this.name} not initialized`
        );
      }

      const data = await queryFn();
      const executionTime = Date.now() - startTime;

      logger.info(`Module ${this.name} query succeeded`, {
        identifier: request.identifier,
        metric: request.metric,
        executionTime,
      });

      return {
        success: true,
        data,
        execution_time_ms: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(`Module ${this.name} query failed`, {
        identifier: request.identifier,
        metric: request.metric,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });

      if (error instanceof GroundTruthError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          execution_time_ms: executionTime,
        };
      }

      return {
        success: false,
        error: {
          code: ErrorCodes.UPSTREAM_FAILURE,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        execution_time_ms: executionTime,
      };
    }
  }

  /**
   * Create a standardized financial metric with provenance
   */
  protected createMetric(
    metricName: string,
    value: number | string | [number, number],
    provenance: Partial<ProvenanceInfo>,
    metadata: Record<string, any> = {},
    rawExtract?: string
  ): FinancialMetric {
    const confidence = this.calculateConfidence(this.tier);

    return {
      type: typeof value === 'number' ? 'metric' : Array.isArray(value) ? 'range' : 'text',
      metric_name: metricName,
      value,
      confidence,
      tier: this.tier,
      source: this.name,
      timestamp: new Date().toISOString(),
      metadata,
      raw_extract: rawExtract,
      provenance: {
        source_type: provenance.source_type || 'api',
        source_url: provenance.source_url,
        filing_type: provenance.filing_type,
        accession_number: provenance.accession_number,
        period: provenance.period,
        extraction_method: provenance.extraction_method || 'api',
        extracted_at: new Date().toISOString(),
        fingerprint: rawExtract ? this.generateFingerprint(rawExtract) : undefined,
      },
    };
  }

  /**
   * Calculate confidence score based on tier and data quality
   */
  protected calculateConfidence(tier: ConfidenceTier, qualityFactors?: number[]): number {
    let baseConfidence: number;

    switch (tier) {
      case 'tier1':
        baseConfidence = 0.95;
        break;
      case 'tier2':
        baseConfidence = 0.70;
        break;
      case 'tier3':
        baseConfidence = 0.40;
        break;
    }

    if (qualityFactors && qualityFactors.length > 0) {
      const avgQuality = qualityFactors.reduce((a, b) => a + b, 0) / qualityFactors.length;
      return Math.min(1.0, baseConfidence * avgQuality);
    }

    return baseConfidence;
  }

  /**
   * Generate SHA-256 fingerprint for raw data provenance
   */
  protected generateFingerprint(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Rate limiting check
   */
  protected async checkRateLimit(domain: string, limit: number): Promise<void> {
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute window
    const key = `rate_limit:${domain}`;

    const history = ((await this.cache.get<number[]>(key)) || []).filter(time => now - time < windowSize);

    if (history.length >= limit) {
      throw new GroundTruthError(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded for ${domain}`
      );
    }

    history.push(now);
    // Use tier3 for shortest cache duration since MemoryCache requires a tier argument
    await this.cache.set(key, history, 'tier3');
  }

  /**
   * Validate request parameters
   */
  protected validateRequest(request: ModuleRequest, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!(field in request) || request[field as keyof ModuleRequest] === undefined) {
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Missing required field: ${field}`
        );
      }
    }
  }
}
