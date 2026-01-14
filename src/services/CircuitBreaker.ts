// Re-export CircuitBreaker from the consolidated main implementation
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
  LLMCircuitBreaker,
} from "../lib/resilience/CircuitBreaker";

// Legacy type exports for backward compatibility
export type {
  CircuitBreakerConfig as CircuitBreakerConfigOld,
  CircuitBreakerState,
} from "./CircuitBreaker.types";
