import { Counter, Gauge } from 'prom-client';

import { getMetricsRegistry } from '../middleware/metricsMiddleware.js';

const registry = getMetricsRegistry();

export const llmProviderActive = new Gauge<'provider'>({
  name: 'llm_provider_active',
  help: 'Active LLM serving provider',
  labelNames: ['provider'],
  registers: [registry],
});

export const llmProviderFallbackActivationsTotal = new Counter<'from_provider' | 'to_provider'>({
  name: 'llm_provider_fallback_activations_total',
  help: 'Provider-level LLM fallback activations',
  labelNames: ['from_provider', 'to_provider'],
  registers: [registry],
});

export const llmCacheHitsTotal = new Counter<'circuit_state'>({
  name: 'llm_cache_hits_total',
  help: 'LLM cache hits by circuit breaker state',
  labelNames: ['circuit_state'],
  registers: [registry],
});
