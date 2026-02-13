/**
 * Circuit Breaker Manager Type Definitions
 */

export interface CircuitBreakerRegistry {
  [key: string]: any;
}

export interface CircuitBreakerManagerConfig {
  default_threshold: number;
  default_timeout_ms: number;
  enable_metrics: boolean;
}

export type AgentCategory = "database" | "external_api" | "llm" | "cache";

export interface CategoryConfig {
  threshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: "closed" | "open" | "half_open";
  failures: number;
  successes: number;
  lastFailure?: number;
}

export interface CircuitBreakerEvent {
  type: "state_change" | "failure" | "success" | "reset";
  breakerName: string;
  timestamp: number;
  details?: Record<string, unknown>;
}
