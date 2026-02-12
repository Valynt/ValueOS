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
