// Re-export from the canonical implementation
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError,
} from "../lib/resilience/CircuitBreaker";

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "../lib/resilience/CircuitBreaker";

// Re-export categorized circuit breaker manager
export {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
  AGENT_CATEGORIES,
} from "./CircuitBreakerManager.categorized";

// Legacy type exports for backward compatibility
export type {
  AgentCategory,
  CategoryConfig,
  CircuitBreakerStats,
  CircuitBreakerEvent,
} from "./CircuitBreakerManager.types";
