/**
 * MCP Financial Ground Truth Server - Type Definitions
 * 
 * Defines all core types for the tiered truth model, data contracts,
 * and module interfaces.
 */

// ============================================================================
// Core Data Contract Types
// ============================================================================

export type MetricType = 'metric' | 'range' | 'text' | 'narrative';

export type ConfidenceTier = 'tier1' | 'tier2' | 'tier3';

export interface FinancialMetric {
  type: MetricType;
  metric_name: string;
  value: number | string | [number, number]; // Single value or range
  confidence: number; // 0.0 to 1.0
  tier: ConfidenceTier;
  source: string;
  timestamp: string; // ISO 8601
  metadata: Record<string, any>;
  raw_extract?: string;
  provenance: ProvenanceInfo;
}

export interface ProvenanceInfo {
  source_type: 'sec-edgar' | 'xbrl' | 'market-api' | 'private-data' | 'benchmark' | 'narrative';
  source_url?: string;
  filing_type?: string;
  accession_number?: string;
  period?: string;
  extraction_method: 'api' | 'xbrl-parse' | 'text-extract' | 'inference';
  extracted_at: string;
  fingerprint?: string; // Hash of raw extract
}

// ============================================================================
// Module Request/Response Types
// ============================================================================

export interface ModuleRequest {
  identifier: string; // CIK, ticker, domain, NAICS code, etc.
  metric?: string;
  period?: string;
  options?: Record<string, any>;
}

export interface ModuleResponse {
  success: boolean;
  data?: FinancialMetric | FinancialMetric[];
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  cache_hit?: boolean;
  execution_time_ms?: number;
}

// ============================================================================
// SEC EDGAR Types
// ============================================================================

export interface EDGARSearchParams {
  cik?: string;
  ticker?: string;
  company_name?: string;
  filing_type?: string; // 10-K, 10-Q, 8-K, etc.
  date_from?: string;
  date_to?: string;
}

export interface EDGARFiling {
  accession_number: string;
  filing_type: string;
  filing_date: string;
  report_date?: string;
  company_name: string;
  cik: string;
  file_url: string;
}

export interface EDGARExtraction {
  section: string;
  content: string;
  keywords_found?: string[];
  metrics_extracted?: Array<{
    name: string;
    value: number | string;
    unit?: string;
    context?: string;
  }>;
}

// ============================================================================
// XBRL Types
// ============================================================================

export interface XBRLFactRequest {
  cik: string;
  taxonomy?: string;
  tag?: string;
  period?: string;
}

export interface XBRLFact {
  tag: string;
  label: string;
  value: number | string;
  unit?: string;
  period: string;
  frame?: string;
  taxonomy: string;
}

export interface XBRLTrendData {
  metric: string;
  periods: string[];
  values: number[];
  unit?: string;
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface MarketQuote {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap?: number;
  timestamp: string;
}

export interface MarketFundamentals {
  ticker: string;
  market_cap: number;
  pe_ratio?: number;
  eps?: number;
  dividend_yield?: number;
  beta?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  ebitda?: number;
  ev_ebitda?: number;
}

// ============================================================================
// Private Company Types
// ============================================================================

export interface PrivateCompanyProfile {
  domain: string;
  company_name: string;
  description?: string;
  founded_year?: number;
  headquarters?: string;
  employee_count?: number | [number, number]; // Exact or range
  revenue_range?: [number, number];
  funding_total?: number;
  last_funding_date?: string;
  last_funding_amount?: number;
  investors?: string[];
  tech_stack?: string[];
}

export interface GrowthSignals {
  domain: string;
  job_postings_count?: number;
  job_postings_growth?: number; // Percentage
  headcount_growth?: number; // Percentage
  funding_velocity?: number; // Months since last round
  web_traffic_rank?: number;
  web_traffic_growth?: number;
  pricing_page_detected?: boolean;
  pricing_tiers?: number;
}

// ============================================================================
// Industry Benchmark Types
// ============================================================================

export interface IndustryBenchmark {
  naics_code: string;
  industry_name: string;
  metric_name: string;
  value: number | [number, number];
  unit?: string;
  percentile?: number; // 25th, 50th, 75th
  year: number;
  source: string;
}

export interface WageData {
  occupation_code: string;
  occupation_title: string;
  metro_area?: string;
  median_wage: number;
  mean_wage: number;
  percentile_10?: number;
  percentile_25?: number;
  percentile_75?: number;
  percentile_90?: number;
  employment_count?: number;
  year: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  key: string;
  value: any;
  tier: ConfidenceTier;
  ttl: number; // Seconds
  created_at: string;
  accessed_at: string;
  access_count: number;
}

export interface CachePolicy {
  tier1_ttl: number; // Permanent or very long
  tier2_ttl: number; // 30 days
  tier3_ttl: number; // 7 days
  max_size_mb: number;
}

// ============================================================================
// Security Types
// ============================================================================

export interface WhitelistEntry {
  domain: string;
  tier: ConfidenceTier;
  rate_limit: number; // Requests per minute
  enabled: boolean;
}

export interface RateLimitStatus {
  domain: string;
  requests_made: number;
  requests_remaining: number;
  reset_at: string;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MetricLog {
  timestamp: string;
  module: string;
  operation: string;
  identifier: string;
  success: boolean;
  execution_time_ms: number;
  cache_hit: boolean;
  tier: ConfidenceTier;
  error_code?: string;
}

export interface AuditLog {
  timestamp: string;
  user_id?: string;
  agent_id?: string;
  module: string;
  operation: string;
  request: any;
  response: any;
  provenance: ProvenanceInfo;
}

// ============================================================================
// Module Interface
// ============================================================================

export interface GroundTruthModule {
  name: string;
  tier: ConfidenceTier;
  description: string;
  
  /**
   * Initialize the module with configuration
   */
  initialize(config: Record<string, any>): Promise<void>;
  
  /**
   * Execute a query against this module
   */
  query(request: ModuleRequest): Promise<ModuleResponse>;
  
  /**
   * Check if this module can handle the given request
   */
  canHandle(request: ModuleRequest): boolean;
  
  /**
   * Get module health status
   */
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
}

// ============================================================================
// Unified Truth Layer Types
// ============================================================================

export interface TruthResolutionRequest {
  identifier: string;
  metric: string;
  period?: string;
  prefer_tier?: ConfidenceTier;
  fallback_enabled?: boolean;
}

export interface TruthResolutionResult {
  metric: FinancialMetric;
  resolution_path: string[]; // Which modules were tried
  fallback_used: boolean;
  alternatives?: FinancialMetric[]; // Other tier results
}

// ============================================================================
// Error Types
// ============================================================================

export class GroundTruthError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GroundTruthError';
  }
}

export const ErrorCodes = {
  NO_DATA_FOUND: 'NO_DATA_FOUND',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CACHE_ERROR: 'CACHE_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;
