import { Counter } from 'prom-client';

import { getMetricsRegistry } from '../middleware/metricsMiddleware.js';

const registry = getMetricsRegistry();

export const authFallbackActivationsTotal = new Counter({
  name: 'auth_fallback_activations_total',
  help: 'Number of emergency JWT fallback activations',
  registers: [registry],
});
