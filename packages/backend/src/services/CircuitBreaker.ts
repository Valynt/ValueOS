// Re-export from the canonical implementation in lib/resilience
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError,
  LLMCircuitBreaker,
} from "../lib/resilience/CircuitBreaker";

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "../lib/resilience/CircuitBreaker";

// Legacy type exports for backward compatibility
export type {
  CircuitBreakerConfig as CircuitBreakerConfigOld,
  CircuitBreakerState,
} from "./CircuitBreaker.types";
