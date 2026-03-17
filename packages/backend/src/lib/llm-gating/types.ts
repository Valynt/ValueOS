/**
 * LLM Gating Types
 * 
 * Types for LLM request gating, throttling, and access control
 */

export interface LLMGateConfig {
  max_requests_per_minute?: number;
  max_tokens_per_request?: number;
  allowed_models?: string[];
  require_approval?: boolean;
  enabled?: boolean;
  cost?: {
    enabled?: boolean;
    warningThreshold?: number;
    downgradeThreshold?: number;
    blockThreshold?: number;
    perRequestLimit?: number;
    allowGracePeriod?: boolean;
  };
  compliance?: {
    enablePIIDetection?: boolean;
    blockingPIITypes?: string[];
    allowRedactedPII?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LLMGateDecision {
  allowed: boolean;
  reason?: string;
  wait_time_ms?: number;
  alternative_model?: string;
}

export interface LLMGateMetrics {
  total_requests: number;
  allowed_requests: number;
  denied_requests: number;
  average_tokens_per_request: number;
  peak_requests_per_minute: number;
}
