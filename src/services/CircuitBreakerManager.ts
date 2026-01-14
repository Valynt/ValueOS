// Re-export CircuitBreakerManager from the consolidated main implementation
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
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
