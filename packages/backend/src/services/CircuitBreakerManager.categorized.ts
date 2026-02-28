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

/** Alias for backward compatibility. */
export const AGENT_CATEGORIES = CIRCUIT_BREAKER_CATEGORIES;

type CircuitState = "closed" | "open" | "half_open";

interface BreakerEntry {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  threshold: number;
  resetTimeout: number;
}

/**
 * Categorized circuit breaker manager.
 */
export class CategorizedCircuitBreakerManager {
  private breakers = new Map<string, BreakerEntry>();

  getBreaker(name: string, _category?: CircuitBreakerCategory): BreakerEntry {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, {
        state: "closed",
        failures: 0,
        lastFailure: 0,
        threshold: 5,
        resetTimeout: 30_000,
      });
    }
    return this.breakers.get(name)!;
  }

  async execute<T>(name: string, fn: () => Promise<T>, category?: CircuitBreakerCategory): Promise<T> {
    const breaker = this.getBreaker(name, category);
    if (breaker.state === "open") {
      if (Date.now() - breaker.lastFailure > breaker.resetTimeout) {
        breaker.state = "half_open";
      } else {
        throw new Error(`Circuit breaker '${name}' is open`);
      }
    }
    try {
      const result = await fn();
      breaker.failures = 0;
      breaker.state = "closed";
      return result;
    } catch (err) {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      if (breaker.failures >= breaker.threshold) {
        breaker.state = "open";
      }
      throw err;
    }
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
      if (breaker.state === 'open') stats[cat].open++;
      else stats[cat].closed++;
    }
    return stats;
  }

  reset(): void {
    this.breakers.clear();
  }

  resetAll(): void {
    this.breakers.clear();
  }
}

let _instance: CategorizedCircuitBreakerManager | null = null;

export function getCategorizedCircuitBreakerManager(): CategorizedCircuitBreakerManager {
  if (!_instance) {
    _instance = new CategorizedCircuitBreakerManager();
  }
  return _instance;
}

export function resetCategorizedCircuitBreakerManager(): void {
  _instance = null;
}
