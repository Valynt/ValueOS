/**
 * Categorized Circuit Breakers
 */

export const CIRCUIT_BREAKER_CATEGORIES = {
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  LLM: 'llm',
  CACHE: 'cache',
} as const;

export type CircuitBreakerCategory = typeof CIRCUIT_BREAKER_CATEGORIES[keyof typeof CIRCUIT_BREAKER_CATEGORIES];
