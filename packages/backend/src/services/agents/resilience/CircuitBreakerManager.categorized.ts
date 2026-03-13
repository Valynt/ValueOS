/**
 * Categorized Circuit Breakers
 *
 * Groups circuit breakers by domain category. Each named breaker delegates
 * to the canonical CircuitBreaker from lib/resilience. ADR-0012.
 */

import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "../../../lib/resilience/CircuitBreaker.js";

export const CIRCUIT_BREAKER_CATEGORIES = {
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  LLM: 'llm',
  CACHE: 'cache',
} as const;

export type CircuitBreakerCategory = typeof CIRCUIT_BREAKER_CATEGORIES[keyof typeof CIRCUIT_BREAKER_CATEGORIES];

/** Alias for backward compatibility. */
export const AGENT_CATEGORIES = CIRCUIT_BREAKER_CATEGORIES;

const CATEGORY_DEFAULTS: Record<CircuitBreakerCategory, Partial<CircuitBreakerConfig>> = {
  database:     { failureThreshold: 5, resetTimeout: 30_000 },
  external_api: { failureThreshold: 5, resetTimeout: 30_000 },
  llm:          { failureThreshold: 3, resetTimeout: 60_000 },
  cache:        { failureThreshold: 5, resetTimeout: 15_000 },
};

/**
 * Manages a pool of named circuit breakers grouped by category.
 * Each breaker is a canonical CircuitBreaker instance.
 */
export class CategorizedCircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(name: string, category?: CircuitBreakerCategory): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaults = category ? CATEGORY_DEFAULTS[category] : {};
      this.breakers.set(name, new CircuitBreaker(defaults));
    }
    return this.breakers.get(name)!;
  }

  async execute<T>(name: string, fn: () => Promise<T>, category?: CircuitBreakerCategory): Promise<T> {
    return this.getBreaker(name, category).execute(fn);
  }

  async executeWithCategory<T>(
    name: string,
    fn: () => Promise<T>,
    category?: CircuitBreakerCategory,
  ): Promise<T> {
    return this.execute(name, fn, category);
  }

  getAllCategoryStats(): Record<string, { total: number; open: number; closed: number }> {
    const stats: Record<string, { total: number; open: number; closed: number }> = {};
    for (const [name, breaker] of this.breakers) {
      const cat = name.split(':')[0] ?? 'default';
      if (!stats[cat]) stats[cat] = { total: 0, open: 0, closed: 0 };
      stats[cat].total++;
      if (breaker.getState() === 'open') stats[cat].open++;
      else stats[cat].closed++;
    }
    return stats;
  }

  reset(): void {
    for (const b of this.breakers.values()) b.reset();
  }

  resetAll(): void {
    this.reset();
  }
}

let _instance: CategorizedCircuitBreakerManager | null = null;

export function getCategorizedCircuitBreakerManager(): CategorizedCircuitBreakerManager {
  if (!_instance) _instance = new CategorizedCircuitBreakerManager();
  return _instance;
}

export function resetCategorizedCircuitBreakerManager(): void {
  _instance = null;
}
