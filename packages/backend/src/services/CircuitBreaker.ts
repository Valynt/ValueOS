// Re-export CircuitBreaker from the consolidated main implementation
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerError,
  LLMCircuitBreaker,
} from "../lib/resilience/CircuitBreaker";

// Export types from the interface file
export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "../lib/resilience/CircuitBreakerInterface";

// Legacy type exports for backward compatibility
export type {
  CircuitBreakerConfig as CircuitBreakerConfigOld,
  CircuitBreakerState,
} from "./CircuitBreaker.types";
