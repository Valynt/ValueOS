/**
 * Agent Fabric Circuit Breaker
 * 
 * Re-exports Circuit Breaker for agent fabric use
 */

export { CircuitBreaker, CircuitBreakerManager } from '../resilience/CircuitBreaker';

export interface SafetyLimits {
  maxTokensPerRequest?: number;
  maxRequestsPerMinute?: number;
  maxConcurrentRequests?: number;
  maxRetries?: number;
  timeoutMs?: number;
  maxExecutionTime?: number;
  [key: string]: unknown;
}
