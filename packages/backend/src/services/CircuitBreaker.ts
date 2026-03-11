// Re-export from the canonical implementation in lib/resilience. ADR-0012.
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError,
  LLMCircuitBreaker,
} from "../lib/resilience/CircuitBreaker.js";

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "../lib/resilience/CircuitBreaker.js";
