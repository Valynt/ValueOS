// Re-export CircuitBreaker from the consolidated main implementation
export {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
} from "../../lib/resilience/CircuitBreaker";

// Legacy exports for backward compatibility
export {
  getCircuitBreaker,
  getAllCircuitBreakers,
} from "./CircuitBreaker.registry";
