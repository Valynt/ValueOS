/**
 * ESO (External Service Orchestration) Types
 * 
 * Types for external service integrations and orchestration
 */

export interface ESOConfig {
  service_id: string;
  service_name: string;
  provider: string;
  endpoint: string;
  auth_type: 'api_key' | 'oauth2' | 'jwt' | 'basic';
  credentials: ESOCredentials;
  retry_policy: RetryPolicy;
  circuit_breaker: CircuitBreakerConfig;
}

export interface ESOCredentials {
  api_key?: string;
  oauth_token?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
}

export interface RetryPolicy {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

export interface CircuitBreakerConfig {
  failure_threshold: number;
  success_threshold: number;
  timeout_ms: number;
  reset_timeout_ms: number;
}

export interface ESORequest {
  service_id: string;
  operation: string;
  parameters: Record<string, any>;
  idempotency_key?: string;
  timeout_ms?: number;
}

export interface ESOResponse {
  service_id: string;
  operation: string;
  status: 'success' | 'failure' | 'timeout';
  data?: Record<string, any>;
  error?: ESOError;
  metadata: ESOMetadata;
}

export interface ESOError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

export interface ESOMetadata {
  request_id: string;
  duration_ms: number;
  attempt_number: number;
  timestamp: string;
}

// ============================================================================
// ESO Ground Truth Domain Types
// ============================================================================

export type ESOIndustry = string;

export type ESOPersona =
  | "cfo"
  | "cio"
  | "vp_ops"
  | "vp_sales"
  | "vp_cs"
  | "ceo"
  | "cto"
  | "cmo";

export type FinancialDriver =
  | "cost_reduction"
  | "revenue_growth"
  | "margin_improvement"
  | "risk_mitigation"
  | "efficiency_gain";

export type ImprovementDirection = "increase" | "decrease" | "maintain";

export interface ESOKPIBenchmarks {
  p25: number;
  p50: number;
  p75: number;
  worldClass?: number;
  source: string;
  vintage: string;
}

export interface ESOKPINode {
  id: string;
  name: string;
  domain: string;
  unit: string;
  improvementDirection: ImprovementDirection;
  dependencies: string[];
  benchmarks: ESOKPIBenchmarks;
}

export interface ESOEdge {
  sourceId: string;
  targetId: string;
  relationship: string;
  weight: number;
}

export interface ESOPersonaValueMap {
  persona: ESOPersona;
  primaryPain: string;
  financialDriver: FinancialDriver;
  keyKPIs: string[];
  communicationPreference: string;
}

export interface BenchmarkAlignmentResult {
  aligned: boolean;
  percentile: string;
  warning?: string;
}

/**
 * Check if a claimed value aligns with known benchmarks for a given metric.
 * Returns alignment status and the percentile bracket.
 */
export function checkBenchmarkAlignment(
  _metricId: string,
  _claimedValue: number
): BenchmarkAlignmentResult {
  // Stub: in production this would look up the metric and compare
  return { aligned: true, percentile: "p50" };
}
