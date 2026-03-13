/**
 * Service Level Objectives (SLO) Configuration
 *
 * Canonical SLO thresholds live here and are the single source of truth for
 * backend config, Prometheus rule templates, Grafana dashboards, and docs.
 */

export interface SLO {
  id: string;
  name: string;
  description: string;
  target: number;
  window: string;
  sli: ServiceLevelIndicator;
  errorBudget: ErrorBudget;
}

export interface ServiceLevelIndicator {
  metric: string;
  goodEvents: string;
  totalEvents: string;
  threshold?: number;
}

export interface ErrorBudget {
  remaining: number;
  consumed: number;
  burnRate: number;
  alertThreshold: number;
}

export const SLO_BASE_THRESHOLDS = {
  apiAvailabilityTarget: 0.999,
  apiLatencyP95Target: 0.95,
  authSuccessTarget: 0.995,
  queueHealthTarget: 0.99,
  agentColdStartTarget: 0.95,
  maxP95LatencyMs: 200,
  warnP95LatencyMs: 150,
  maxErrorRate: 0.001,
  warnErrorRate: 0.0005,
  maxMttrMinutes: 15,
  warnMttrMinutes: 10,
  apiLatencyBucketLeSeconds: 0.3,
  agentColdStartThresholdSeconds: 45,
  burnRateCritical: 14.4,
  availabilityFastBurnErrorRateThreshold: 0.01,
  availabilitySlowBurnErrorRateThreshold: 0.001,
} as const;

export const SLO_ENVIRONMENT_OVERRIDES = {
  development: {
    apiAvailabilityTarget: 0.995,
    maxP95LatencyMs: 400,
    warnP95LatencyMs: 300,
    maxErrorRate: 0.005,
    warnErrorRate: 0.0025,
    maxMttrMinutes: 30,
    warnMttrMinutes: 20,
  },
  test: {
    maxP95LatencyMs: 250,
    warnP95LatencyMs: 175,
    maxErrorRate: 0.002,
    warnErrorRate: 0.001,
    maxMttrMinutes: 20,
    warnMttrMinutes: 15,
  },
  staging: {
    apiAvailabilityTarget: 0.998,
    maxP95LatencyMs: 250,
    warnP95LatencyMs: 180,
    maxErrorRate: 0.002,
    warnErrorRate: 0.001,
    maxMttrMinutes: 20,
    warnMttrMinutes: 15,
  },
  production: {},
} as const;

type RuntimeEnvironment = keyof typeof SLO_ENVIRONMENT_OVERRIDES;

type SLOThresholds = typeof SLO_BASE_THRESHOLDS;

const SLO_ENV_VAR_MAP: Record<keyof SLOThresholds, string> = {
  apiAvailabilityTarget: 'SLO_API_AVAILABILITY_TARGET',
  apiLatencyP95Target: 'SLO_API_LATENCY_P95_TARGET',
  authSuccessTarget: 'SLO_AUTH_SUCCESS_TARGET',
  queueHealthTarget: 'SLO_QUEUE_HEALTH_TARGET',
  agentColdStartTarget: 'SLO_AGENT_COLD_START_TARGET',
  maxP95LatencyMs: 'SLO_MAX_P95_LATENCY_MS',
  warnP95LatencyMs: 'SLO_WARN_P95_LATENCY_MS',
  maxErrorRate: 'SLO_MAX_ERROR_RATE',
  warnErrorRate: 'SLO_WARN_ERROR_RATE',
  maxMttrMinutes: 'SLO_MAX_MTTR_MINUTES',
  warnMttrMinutes: 'SLO_WARN_MTTR_MINUTES',
  apiLatencyBucketLeSeconds: 'SLO_API_LATENCY_BUCKET_LE_SECONDS',
  agentColdStartThresholdSeconds: 'SLO_AGENT_COLD_START_THRESHOLD_SECONDS',
  burnRateCritical: 'SLO_BURN_RATE_CRITICAL',
  availabilityFastBurnErrorRateThreshold: 'SLO_AVAILABILITY_FAST_BURN_ERROR_RATE_THRESHOLD',
  availabilitySlowBurnErrorRateThreshold: 'SLO_AVAILABILITY_SLOW_BURN_ERROR_RATE_THRESHOLD',
};

const parseEnvNumber = (key: string): number | undefined => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const getCanonicalSLOThresholds = (
  runtimeEnvironment = (process.env.NODE_ENV as RuntimeEnvironment | undefined) ?? 'production',
): SLOThresholds => {
  const environmentOverrides = SLO_ENVIRONMENT_OVERRIDES[runtimeEnvironment] ?? SLO_ENVIRONMENT_OVERRIDES.production;
  const mergedThresholds = {
    ...SLO_BASE_THRESHOLDS,
    ...environmentOverrides,
  } as SLOThresholds;

  const withEnvironmentVariables = { ...mergedThresholds };
  for (const [thresholdKey, envVarName] of Object.entries(SLO_ENV_VAR_MAP) as [keyof SLOThresholds, string][]) {
    const envOverride = parseEnvNumber(envVarName);
    if (envOverride !== undefined) {
      withEnvironmentVariables[thresholdKey] = envOverride;
    }
  }

  return withEnvironmentVariables;
};

export const CANONICAL_SLO_THRESHOLDS = getCanonicalSLOThresholds();

export const PRODUCTION_SLOS: SLO[] = [
  {
    id: 'availability',
    name: 'API Availability',
    description: '99.9% of API requests succeed (non-5xx responses)',
    target: CANONICAL_SLO_THRESHOLDS.apiAvailabilityTarget,
    window: '30d',
    sli: {
      metric: 'api.availability',
      goodEvents: 'http_requests_total{status!~"5.."}',
      totalEvents: 'http_requests_total',
    },
    errorBudget: {
      remaining: 1 - CANONICAL_SLO_THRESHOLDS.apiAvailabilityTarget,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - CANONICAL_SLO_THRESHOLDS.apiAvailabilityTarget) / 2,
    },
  },
  {
    id: 'latency-p95',
    name: 'API Latency (P95)',
    description: `95% of API requests complete within ${CANONICAL_SLO_THRESHOLDS.maxP95LatencyMs} ms`,
    target: CANONICAL_SLO_THRESHOLDS.apiLatencyP95Target,
    window: '30d',
    sli: {
      metric: 'api.latency_p95',
      goodEvents: `http_request_duration_seconds{quantile="0.95"} < ${CANONICAL_SLO_THRESHOLDS.maxP95LatencyMs / 1000}`,
      totalEvents: 'http_requests_total',
      threshold: CANONICAL_SLO_THRESHOLDS.maxP95LatencyMs,
    },
    errorBudget: {
      remaining: 1 - CANONICAL_SLO_THRESHOLDS.apiLatencyP95Target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - CANONICAL_SLO_THRESHOLDS.apiLatencyP95Target) / 2,
    },
  },
  {
    id: 'agent-success-rate',
    name: 'Agent Success Rate',
    description: '95% of agent executions succeed without errors',
    target: 0.95,
    window: '7d',
    sli: {
      metric: 'agent.success_rate',
      goodEvents: 'agent_executions_total{status="success"}',
      totalEvents: 'agent_executions_total',
    },
    errorBudget: {
      remaining: 0.05,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.025,
    },
  },
];

export function calculateErrorBudget(goodEvents: number, totalEvents: number, target: number): ErrorBudget {
  if (totalEvents === 0) {
    return {
      remaining: 1 - target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - target) / 2,
    };
  }

  const actualSLI = goodEvents / totalEvents;
  const errorBudget = 1 - target;
  const consumed = Math.max(0, target - actualSLI);
  const remaining = Math.max(0, errorBudget - consumed);

  return {
    remaining,
    consumed,
    burnRate: consumed / errorBudget,
    alertThreshold: errorBudget / 2,
  };
}

export function isSLOAtRisk(slo: SLO): boolean {
  return slo.errorBudget.remaining < slo.errorBudget.alertThreshold;
}

export function getSLOStatus(slo: SLO): 'healthy' | 'warning' | 'critical' {
  const { remaining, alertThreshold } = slo.errorBudget;
  if (remaining <= 0) {
    return 'critical';
  }
  if (remaining < alertThreshold) {
    return 'warning';
  }
  return 'healthy';
}

export const BURN_RATE_ALERTS = {
  fast: {
    window: '1h',
    burnRate: CANONICAL_SLO_THRESHOLDS.burnRateCritical,
    severity: 'critical' as const,
    description: 'Error budget will be exhausted in 2 hours at current rate',
  },
  medium: {
    window: '6h',
    burnRate: 6,
    severity: 'warning' as const,
    description: 'Error budget will be exhausted in 5 days at current rate',
  },
  slow: {
    window: '3d',
    burnRate: 1,
    severity: 'info' as const,
    description: 'Error budget consumption on track',
  },
};

export function getSLOById(id: string): SLO | undefined {
  return PRODUCTION_SLOS.find((slo) => slo.id === id);
}

export function getSLOsAtRisk(): SLO[] {
  return PRODUCTION_SLOS.filter(isSLOAtRisk);
}

export function validateSLOConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = PRODUCTION_SLOS.map((s) => s.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate SLO IDs: ${duplicates.join(', ')}`);
  }

  for (const slo of PRODUCTION_SLOS) {
    if (slo.target < 0 || slo.target > 1) {
      errors.push(`Invalid target for ${slo.id}: ${slo.target} (must be 0-1)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
