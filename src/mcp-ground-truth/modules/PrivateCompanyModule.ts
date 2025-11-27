/**
 * Private Company Module - Tier 2 Proxy-Based Estimation
 * 
 * Generates financial estimates for private companies using proxy data:
 * - Headcount (LinkedIn, ZoomInfo)
 * - Funding data (Crunchbase, Pitchbook)
 * - Web traffic and growth signals
 * - Industry benchmarks for revenue per employee
 * 
 * Tier 2 classification: High-confidence estimates with explicit confidence scoring
 * and rationale. All outputs include estimation methodology.
 * 
 * Node Mapping: [NODE: Tier_2_Proxy], [NODE: Private_Entity_Estimation]
 */

import { BaseModule } from '../core/BaseModule';
import {
  ModuleRequest,
  ModuleResponse,
  FinancialMetric,
  PrivateCompanyProfile,
  GrowthSignals,
  GroundTruthError,
  ErrorCodes,
} from '../types';
import { logger } from '../../utils/logger';

interface PrivateCompanyConfig {
  crunchbaseApiKey?: string;
  zoomInfoApiKey?: string;
  linkedInApiKey?: string;
  enableWebScraping: boolean;
  confidenceThreshold: number; // Minimum confidence to return estimate
}

/**
 * Private Company Module - Tier 2 Estimation Engine
 * 
 * Implements MCP tool: get_private_entity_estimates
 * Uses proxy metrics to derive financial estimates with confidence scoring
 */
export class PrivateCompanyModule extends BaseModule {
  name = 'private-company';
  tier = 'tier2' as const;
  description = 'Private company financial estimation using proxy data - Tier 2 high-confidence estimates';

  private crunchbaseApiKey?: string;
  private zoomInfoApiKey?: string;
  private linkedInApiKey?: string;
  private enableWebScraping: boolean = false;
  private confidenceThreshold: number = 0.5;

  // Industry-specific revenue per employee benchmarks (in USD)
  private readonly REVENUE_PER_EMPLOYEE_BENCHMARKS: Record<string, number> = {
    // Technology
    '541511': 250000, // Custom Computer Programming Services
    '541512': 200000, // Computer Systems Design Services
    '518210': 350000, // Data Processing, Hosting, and Related Services
    '511210': 400000, // Software Publishers
    
    // Professional Services
    '541611': 180000, // Administrative Management and General Management Consulting
    '541618': 150000, // Other Management Consulting Services
    '541613': 200000, // Marketing Consulting Services
    
    // Financial Services
    '523110': 500000, // Investment Banking and Securities Dealing
    '522110': 300000, // Commercial Banking
    '524113': 250000, // Direct Life Insurance Carriers
    
    // Healthcare
    '621111': 400000, // Offices of Physicians
    '621511': 300000, // Medical Laboratories
    '621610': 200000, // Home Health Care Services
    
    // Manufacturing
    '334111': 350000, // Electronic Computer Manufacturing
    '336411': 400000, // Aircraft Manufacturing
    '325412': 500000, // Pharmaceutical Preparation Manufacturing
    
    // Default fallback
    'default': 200000,
  };

  async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);
    
    const privateConfig = config as PrivateCompanyConfig;
    this.crunchbaseApiKey = privateConfig.crunchbaseApiKey;
    this.zoomInfoApiKey = privateConfig.zoomInfoApiKey;
    this.linkedInApiKey = privateConfig.linkedInApiKey;
    this.enableWebScraping = privateConfig.enableWebScraping || false;
    this.confidenceThreshold = privateConfig.confidenceThreshold || 0.5;

    logger.info('Private Company Module initialized', {
      hasCrunchbase: !!this.crunchbaseApiKey,
      hasZoomInfo: !!this.zoomInfoApiKey,
      hasLinkedIn: !!this.linkedInApiKey,
      enableWebScraping: this.enableWebScraping,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle domain names
    return !!(
      request.identifier &&
      request.identifier.match(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i)
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      this.validateRequest(request, ['identifier']);

      const { identifier: domain, metric, options } = request;

      // Get company profile
      const profile = await this.getCompanyProfile(domain);

      // Get growth signals
      const signals = await this.getGrowthSignals(domain);

      // Determine industry code
      const industryCode = options?.industry_code || 'default';

      // Calculate estimates based on requested metric
      if (!metric || metric === 'revenue_estimate') {
        return await this.estimateRevenue(profile, signals, industryCode);
      } else if (metric === 'employee_count') {
        return this.createMetric(
          'employee_count',
          profile.employee_count || [0, 0],
          {
            source_type: 'private-data',
            extraction_method: 'inference',
          },
          {
            domain,
            source: 'aggregated',
            confidence_factors: ['linkedin', 'crunchbase'],
          },
          JSON.stringify(profile)
        );
      } else if (metric === 'growth_signals') {
        return this.createMetric(
          'growth_signals',
          JSON.stringify(signals),
          {
            source_type: 'private-data',
            extraction_method: 'inference',
          },
          {
            domain,
            ...signals,
          },
          JSON.stringify(signals)
        );
      }

      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        `Unsupported metric: ${metric}`
      );
    });
  }

  /**
   * Get company profile from multiple sources
   * 
   * Aggregates data from Crunchbase, ZoomInfo, LinkedIn, and web scraping
   */
  private async getCompanyProfile(domain: string): Promise<PrivateCompanyProfile> {
    const profile: PrivateCompanyProfile = {
      domain,
      company_name: '',
    };

    // Try Crunchbase first
    if (this.crunchbaseApiKey) {
      try {
        const crunchbaseData = await this.getCrunchbaseData(domain);
        Object.assign(profile, crunchbaseData);
      } catch (error) {
        logger.warn('Crunchbase lookup failed', { domain, error });
      }
    }

    // Augment with ZoomInfo
    if (this.zoomInfoApiKey) {
      try {
        const zoomInfoData = await this.getZoomInfoData(domain);
        // Merge data, preferring more specific values
        if (zoomInfoData.employee_count) {
          profile.employee_count = zoomInfoData.employee_count;
        }
        if (zoomInfoData.revenue_range) {
          profile.revenue_range = zoomInfoData.revenue_range;
        }
      } catch (error) {
        logger.warn('ZoomInfo lookup failed', { domain, error });
      }
    }

    // Augment with LinkedIn
    if (this.linkedInApiKey) {
      try {
        const linkedInData = await this.getLinkedInData(domain);
        if (linkedInData.employee_count && !profile.employee_count) {
          profile.employee_count = linkedInData.employee_count;
        }
      } catch (error) {
        logger.warn('LinkedIn lookup failed', { domain, error });
      }
    }

    // Web scraping as fallback
    if (this.enableWebScraping && !profile.company_name) {
      try {
        const scrapedData = await this.scrapeCompanyWebsite(domain);
        Object.assign(profile, scrapedData);
      } catch (error) {
        logger.warn('Web scraping failed', { domain, error });
      }
    }

    if (!profile.company_name) {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        `No data found for domain: ${domain}`
      );
    }

    return profile;
  }

  /**
   * Get growth signals for a company
   */
  private async getGrowthSignals(domain: string): Promise<GrowthSignals> {
    const signals: GrowthSignals = {
      domain,
    };

    // Job postings analysis (would integrate with job boards API)
    // Placeholder implementation
    signals.job_postings_count = 0;
    signals.job_postings_growth = 0;

    // Web traffic analysis (would integrate with SimilarWeb, Alexa, etc.)
    // Placeholder implementation
    signals.web_traffic_rank = undefined;
    signals.web_traffic_growth = undefined;

    // Pricing page detection
    signals.pricing_page_detected = false;
    signals.pricing_tiers = 0;

    return signals;
  }

  /**
   * Estimate revenue using proxy metrics
   * 
   * Primary method: Headcount × Revenue per Employee (industry benchmark)
   * Confidence scoring based on data quality and recency
   */
  private async estimateRevenue(
    profile: PrivateCompanyProfile,
    signals: GrowthSignals,
    industryCode: string
  ): Promise<FinancialMetric> {
    // Get industry benchmark
    const revenuePerEmployee = this.REVENUE_PER_EMPLOYEE_BENCHMARKS[industryCode] || 
                               this.REVENUE_PER_EMPLOYEE_BENCHMARKS.default;

    // Calculate base estimate
    let estimatedRevenue: number | [number, number];
    let confidence: number;
    let rationale: string;

    if (typeof profile.employee_count === 'number') {
      // Exact headcount available
      estimatedRevenue = profile.employee_count * revenuePerEmployee;
      confidence = 0.70; // Base confidence for exact headcount
      rationale = `Estimated using exact headcount (${profile.employee_count}) × industry benchmark ($${revenuePerEmployee.toLocaleString()}/employee)`;
    } else if (Array.isArray(profile.employee_count)) {
      // Headcount range available
      const [min, max] = profile.employee_count;
      estimatedRevenue = [
        min * revenuePerEmployee,
        max * revenuePerEmployee,
      ];
      confidence = 0.60; // Lower confidence for range
      rationale = `Estimated using headcount range (${min}-${max}) × industry benchmark ($${revenuePerEmployee.toLocaleString()}/employee)`;
    } else {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        'Insufficient data for revenue estimation'
      );
    }

    // Adjust confidence based on data quality factors
    const qualityFactors: number[] = [];

    // Factor 1: Data source quality
    if (profile.employee_count) {
      qualityFactors.push(1.0); // Has headcount data
    }

    // Factor 2: Funding data availability (indicates data quality)
    if (profile.funding_total && profile.funding_total > 0) {
      qualityFactors.push(1.1); // Boost confidence if funding data available
    }

    // Factor 3: Growth signals
    if (signals.job_postings_count && signals.job_postings_count > 10) {
      qualityFactors.push(1.05); // Active hiring indicates growth
    }

    // Factor 4: Revenue range cross-validation
    if (profile.revenue_range) {
      const [minRevenue, maxRevenue] = profile.revenue_range;
      const estimatedMid = Array.isArray(estimatedRevenue)
        ? (estimatedRevenue[0] + estimatedRevenue[1]) / 2
        : estimatedRevenue;
      
      // Check if our estimate falls within reported range
      if (estimatedMid >= minRevenue && estimatedMid <= maxRevenue) {
        qualityFactors.push(1.2); // Strong validation
        rationale += `. Validated against reported revenue range ($${minRevenue.toLocaleString()}-$${maxRevenue.toLocaleString()})`;
      }
    }

    // Calculate final confidence
    const finalConfidence = this.calculateConfidence(this.tier, qualityFactors);

    // Check confidence threshold
    if (finalConfidence < this.confidenceThreshold) {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        `Confidence (${finalConfidence.toFixed(2)}) below threshold (${this.confidenceThreshold})`
      );
    }

    return this.createMetric(
      'revenue_estimate',
      estimatedRevenue,
      {
        source_type: 'private-data',
        extraction_method: 'inference',
      },
      {
        domain: profile.domain,
        company_name: profile.company_name,
        estimation_method: 'headcount_proxy',
        headcount: profile.employee_count,
        revenue_per_employee: revenuePerEmployee,
        industry_code: industryCode,
        confidence: finalConfidence,
        rationale,
        quality_factors: qualityFactors,
      },
      JSON.stringify({ profile, signals })
    );
  }

  // ============================================================================
  // Data Source Integrations (Placeholder Implementations)
  // ============================================================================

  private async getCrunchbaseData(domain: string): Promise<Partial<PrivateCompanyProfile>> {
    if (!this.crunchbaseApiKey) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'Crunchbase API key not configured');
    }

    // Placeholder: Would integrate with Crunchbase API
    // https://data.crunchbase.com/docs/using-the-api
    
    logger.debug('Crunchbase lookup', { domain });
    
    // Mock implementation
    return {
      company_name: domain.split('.')[0],
      employee_count: [50, 100],
      funding_total: 10000000,
    };
  }

  private async getZoomInfoData(domain: string): Promise<Partial<PrivateCompanyProfile>> {
    if (!this.zoomInfoApiKey) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'ZoomInfo API key not configured');
    }

    // Placeholder: Would integrate with ZoomInfo API
    logger.debug('ZoomInfo lookup', { domain });
    
    return {};
  }

  private async getLinkedInData(domain: string): Promise<Partial<PrivateCompanyProfile>> {
    if (!this.linkedInApiKey) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'LinkedIn API key not configured');
    }

    // Placeholder: Would integrate with LinkedIn Company API
    logger.debug('LinkedIn lookup', { domain });
    
    return {};
  }

  private async scrapeCompanyWebsite(domain: string): Promise<Partial<PrivateCompanyProfile>> {
    if (!this.enableWebScraping) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'Web scraping not enabled');
    }

    // Placeholder: Would implement web scraping with proper rate limiting
    // and robots.txt compliance
    logger.debug('Web scraping', { domain });
    
    return {
      company_name: domain.split('.')[0],
    };
  }

  /**
   * Calculate productivity delta vs industry benchmark
   * 
   * Used for Value Driver Tree population
   */
  async calculateProductivityDelta(
    domain: string,
    industryCode: string
  ): Promise<{
    actual_revenue_per_employee: number;
    benchmark_revenue_per_employee: number;
    delta: number;
    delta_percent: number;
  }> {
    const profile = await this.getCompanyProfile(domain);
    const signals = await this.getGrowthSignals(domain);
    
    const benchmark = this.REVENUE_PER_EMPLOYEE_BENCHMARKS[industryCode] || 
                     this.REVENUE_PER_EMPLOYEE_BENCHMARKS.default;

    // Calculate actual revenue per employee
    let actualRevenuePerEmployee: number;
    
    if (profile.revenue_range && profile.employee_count) {
      const avgRevenue = (profile.revenue_range[0] + profile.revenue_range[1]) / 2;
      const avgHeadcount = Array.isArray(profile.employee_count)
        ? (profile.employee_count[0] + profile.employee_count[1]) / 2
        : profile.employee_count;
      
      actualRevenuePerEmployee = avgRevenue / avgHeadcount;
    } else {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        'Insufficient data for productivity calculation'
      );
    }

    const delta = benchmark - actualRevenuePerEmployee;
    const deltaPercent = (delta / benchmark) * 100;

    return {
      actual_revenue_per_employee: actualRevenuePerEmployee,
      benchmark_revenue_per_employee: benchmark,
      delta,
      delta_percent: deltaPercent,
    };
  }
}
