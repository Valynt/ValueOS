// Re-export from the canonical implementation in lib/resilience. ADR-0012.
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError,
} from "../lib/resilience/CircuitBreaker.js";

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "../lib/resilience/CircuitBreaker.js";

// Categorized circuit breaker manager (delegates to canonical CircuitBreaker internally)
export {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
  AGENT_CATEGORIES,
} from "./CircuitBreakerManager.categorized.js";
