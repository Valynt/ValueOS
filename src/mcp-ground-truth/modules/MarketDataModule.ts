/**
 * Market Data Module - Tier 2 Real-Time Market Intelligence
 * 
 * Provides real-time and historical market data from multiple providers.
 * Integrates with Alpha Vantage, Polygon.io, and other market data APIs.
 * 
 * Tier 2 classification: High-confidence but not authoritative (market data
 * is real-time/delayed and subject to revisions).
 * 
 * Security: IL4 with API key rotation
 */

import { BaseModule } from '../core/BaseModule';
import {
  ModuleRequest,
  ModuleResponse,
  FinancialMetric,
  MarketQuote,
  MarketFundamentals,
  GroundTruthError,
  ErrorCodes,
} from '../types';
import { logger } from '../../lib/logger';

interface MarketDataConfig {
  provider: 'alphavantage' | 'polygon' | 'tiingo';
  apiKey: string;
  rateLimit: number;
  cacheTTL: number; // Cache time-to-live in seconds
}

/**
 * Market Data Module - Tier 2 Market Intelligence
 * 
 * Implements real-time quotes, fundamentals, and market multiples
 * Node Mapping: [NODE: Market_Data_Module], [NODE: Tier_2_Proxy]
 */
export class MarketDataModule extends BaseModule {
  name = 'market-data';
  tier = 'tier2' as const;
  description = 'Real-time market data and fundamentals - Tier 2 high-confidence source';

  private provider: 'alphavantage' | 'polygon' | 'tiingo' = 'alphavantage';
  private apiKey: string = '';
  private rateLimit: number = 5; // Requests per minute
  private cacheTTL: number = 300; // 5 minutes default
  private lastRequestTime: number = 0;
  private quoteCache: Map<string, { data: any; timestamp: number }> = new Map();

  // Provider-specific base URLs
  private readonly PROVIDER_URLS = {
    alphavantage: 'https://www.alphavantage.co/query',
    polygon: 'https://api.polygon.io',
    tiingo: 'https://api.tiingo.com',
  };

  async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);
    
    const marketConfig = config as MarketDataConfig;
    this.provider = marketConfig.provider || 'alphavantage';
    this.apiKey = marketConfig.apiKey;
    this.rateLimit = marketConfig.rateLimit || 5;
    this.cacheTTL = marketConfig.cacheTTL || 300;

    if (!this.apiKey) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        'Market data API key is required'
      );
    }

    logger.info('Market Data Module initialized', {
      provider: this.provider,
      rateLimit: this.rateLimit,
      cacheTTL: this.cacheTTL,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle ticker symbols
    return !!(
      request.identifier &&
      request.identifier.match(/^[A-Z]{1,5}$/) && // Ticker format
      (request.metric?.includes('quote') || 
       request.metric?.includes('market') ||
       request.metric?.includes('fundamental'))
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      this.validateRequest(request, ['identifier']);

      const { identifier: ticker, metric, options } = request;

      // Route to appropriate handler based on metric
      if (!metric || metric.includes('quote')) {
        return await this.getQuote(ticker);
      } else if (metric.includes('fundamental')) {
        return await this.getFundamentals(ticker);
      } else if (metric.includes('multiple')) {
        return await this.getMultiples(ticker);
      }

      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        `Unsupported metric: ${metric}`
      );
    });
  }

  /**
   * Get real-time quote for a ticker
   */
  private async getQuote(ticker: string): Promise<FinancialMetric> {
    // Check cache first
    const cached = this.getCachedData(ticker, 'quote');
    if (cached) {
      logger.debug('Market quote cache hit', { ticker });
      return this.createMetricFromQuote(cached as MarketQuote, true);
    }

    await this.enforceRateLimit();

    let quote: MarketQuote;

    switch (this.provider) {
      case 'alphavantage':
        quote = await this.getQuoteAlphaVantage(ticker);
        break;
      case 'polygon':
        quote = await this.getQuotePolygon(ticker);
        break;
      case 'tiingo':
        quote = await this.getQuoteTiingo(ticker);
        break;
      default:
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Unsupported provider: ${this.provider}`
        );
    }

    // Cache the result
    this.setCachedData(ticker, 'quote', quote);

    return this.createMetricFromQuote(quote, false);
  }

  /**
   * Get fundamentals for a ticker
   */
  private async getFundamentals(ticker: string): Promise<FinancialMetric> {
    // Check cache first
    const cached = this.getCachedData(ticker, 'fundamentals');
    if (cached) {
      logger.debug('Market fundamentals cache hit', { ticker });
      return this.createMetricFromFundamentals(cached as MarketFundamentals, true);
    }

    await this.enforceRateLimit();

    let fundamentals: MarketFundamentals;

    switch (this.provider) {
      case 'alphavantage':
        fundamentals = await this.getFundamentalsAlphaVantage(ticker);
        break;
      case 'polygon':
        fundamentals = await this.getFundamentalsPolygon(ticker);
        break;
      default:
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Fundamentals not supported for provider: ${this.provider}`
        );
    }

    // Cache the result
    this.setCachedData(ticker, 'fundamentals', fundamentals);

    return this.createMetricFromFundamentals(fundamentals, false);
  }

  /**
   * Get market multiples (P/E, EV/EBITDA, etc.)
   */
  private async getMultiples(ticker: string): Promise<FinancialMetric> {
    const fundamentals = await this.getFundamentals(ticker);
    
    // Extract multiples from fundamentals
    const multiplesData = {
      ticker,
      pe_ratio: (fundamentals.metadata as any).pe_ratio,
      ev_ebitda: (fundamentals.metadata as any).ev_ebitda,
      price_to_book: (fundamentals.metadata as any).price_to_book,
      price_to_sales: (fundamentals.metadata as any).price_to_sales,
    };

    return this.createMetric(
      'market_multiples',
      JSON.stringify(multiplesData),
      {
        source_type: 'market-api',
        source_url: this.PROVIDER_URLS[this.provider],
        extraction_method: 'api',
      },
      {
        provider: this.provider,
        ticker,
        ...multiplesData,
      }
    );
  }

  // ============================================================================
  // Alpha Vantage Implementation
  // ============================================================================

  private async getQuoteAlphaVantage(ticker: string): Promise<MarketQuote> {
    const url = `${this.PROVIDER_URLS.alphavantage}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Alpha Vantage API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (data['Error Message']) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `Ticker ${ticker} not found`
        );
      }

      if (data['Note']) {
        throw new GroundTruthError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          'Alpha Vantage rate limit exceeded'
        );
      }

      const quote = data['Global Quote'];
      if (!quote) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No quote data for ${ticker}`
        );
      }

      return {
        ticker,
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        change_percent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch quote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async getFundamentalsAlphaVantage(ticker: string): Promise<MarketFundamentals> {
    const url = `${this.PROVIDER_URLS.alphavantage}?function=OVERVIEW&symbol=${ticker}&apikey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Alpha Vantage API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (data['Error Message'] || Object.keys(data).length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No fundamental data for ${ticker}`
        );
      }

      return {
        ticker,
        market_cap: parseFloat(data.MarketCapitalization) || 0,
        pe_ratio: parseFloat(data.PERatio) || undefined,
        eps: parseFloat(data.EPS) || undefined,
        dividend_yield: parseFloat(data.DividendYield) || undefined,
        beta: parseFloat(data.Beta) || undefined,
        fifty_two_week_high: parseFloat(data['52WeekHigh']) || undefined,
        fifty_two_week_low: parseFloat(data['52WeekLow']) || undefined,
        ebitda: parseFloat(data.EBITDA) || undefined,
      };
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch fundamentals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Polygon.io Implementation
  // ============================================================================

  private async getQuotePolygon(ticker: string): Promise<MarketQuote> {
    const url = `${this.PROVIDER_URLS.polygon}/v2/aggs/ticker/${ticker}/prev?apiKey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Polygon API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No quote data for ${ticker}`
        );
      }

      const result = data.results[0];

      return {
        ticker,
        price: result.c, // Close price
        change: result.c - result.o, // Close - Open
        change_percent: ((result.c - result.o) / result.o) * 100,
        volume: result.v,
        timestamp: new Date(result.t).toISOString(),
      };
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch quote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async getFundamentalsPolygon(ticker: string): Promise<MarketFundamentals> {
    const url = `${this.PROVIDER_URLS.polygon}/v3/reference/tickers/${ticker}?apiKey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Polygon API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No fundamental data for ${ticker}`
        );
      }

      const results = data.results;

      return {
        ticker,
        market_cap: results.market_cap || 0,
        // Polygon provides limited fundamentals in basic tier
        // Would need additional endpoints for full fundamental data
      };
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch fundamentals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Tiingo Implementation
  // ============================================================================

  private async getQuoteTiingo(ticker: string): Promise<MarketQuote> {
    const url = `${this.PROVIDER_URLS.tiingo}/tiingo/daily/${ticker}/prices?token=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Tiingo API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No quote data for ${ticker}`
        );
      }

      const latest = data[0];

      return {
        ticker,
        price: latest.close,
        change: latest.close - latest.open,
        change_percent: ((latest.close - latest.open) / latest.open) * 100,
        volume: latest.volume,
        timestamp: latest.date,
      };
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch quote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createMetricFromQuote(quote: MarketQuote, cacheHit: boolean): FinancialMetric {
    return this.createMetric(
      'market_quote',
      quote.price,
      {
        source_type: 'market-api',
        source_url: this.PROVIDER_URLS[this.provider],
        extraction_method: 'api',
      },
      {
        provider: this.provider,
        ticker: quote.ticker,
        change: quote.change,
        change_percent: quote.change_percent,
        volume: quote.volume,
        cache_hit: cacheHit,
      },
      JSON.stringify(quote)
    );
  }

  private createMetricFromFundamentals(fundamentals: MarketFundamentals, cacheHit: boolean): FinancialMetric {
    return this.createMetric(
      'market_fundamentals',
      fundamentals.market_cap,
      {
        source_type: 'market-api',
        source_url: this.PROVIDER_URLS[this.provider],
        extraction_method: 'api',
      },
      {
        provider: this.provider,
        ticker: fundamentals.ticker,
        pe_ratio: fundamentals.pe_ratio,
        eps: fundamentals.eps,
        beta: fundamentals.beta,
        ebitda: fundamentals.ebitda,
        cache_hit: cacheHit,
      },
      JSON.stringify(fundamentals)
    );
  }

  private getCachedData(ticker: string, type: string): any | null {
    const key = `${ticker}:${type}`;
    const cached = this.quoteCache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL * 1000) {
      this.quoteCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(ticker: string, type: string, data: any): void {
    const key = `${ticker}:${type}`;
    this.quoteCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = (60 * 1000) / this.rateLimit; // Convert RPM to milliseconds
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  clearCache(): void {
    this.quoteCache.clear();
    logger.info('Market data cache cleared');
  }
}
