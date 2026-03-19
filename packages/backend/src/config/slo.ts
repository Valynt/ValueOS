/**
 * Service Level Objectives (SLO) configuration.
 *
 * Canonical thresholds live in this module and may be overridden per deployment
 * environment with explicit env vars.
 */

export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export type LatencyClass = 'interactive' | 'orchestration';

export interface SLOThresholdSet {
  availabilityTarget: number;
  interactiveLatencyP95Target: number;
  interactiveLatencyP95Ms: number;
  orchestrationTtfbP95Target: number;
  orchestrationTtfbP95Ms: number;
  orchestrationCompletionP95Target: number;
  orchestrationCompletionP95Ms: number;
  authSuccessTarget: number;
  queueHealthTarget: number;
  queueDepthMax: number;
  queueOldestAgeSecondsMax: number;
  agentColdStartTarget: number;
  agentColdStartSecondsMax: number;
  errorRateFastBurnMax: number;
  errorRateSlowBurnMax: number;
  mttrMinutesMax: number;
  burnRateCritical: number;
}

export const CANONICAL_SLO_THRESHOLDS: SLOThresholdSet = {
  availabilityTarget: 0.999,
  interactiveLatencyP95Target: 0.95,
  interactiveLatencyP95Ms: 200,
  orchestrationTtfbP95Target: 0.95,
  orchestrationTtfbP95Ms: 200,
  orchestrationCompletionP95Target: 0.95,
  orchestrationCompletionP95Ms: 3000,
  authSuccessTarget: 0.995,
  queueHealthTarget: 0.99,
  queueDepthMax: 100,
  queueOldestAgeSecondsMax: 120,
  agentColdStartTarget: 0.95,
  agentColdStartSecondsMax: 45,
  errorRateFastBurnMax: 0.01,
  errorRateSlowBurnMax: 0.001,
  mttrMinutesMax: 15,
  burnRateCritical: 14.4,
};

export const SLO_ENVIRONMENT_OVERRIDES: Record<DeploymentEnvironment, Partial<SLOThresholdSet>> = {
  development: {
    interactiveLatencyP95Ms: 350,
    orchestrationTtfbP95Ms: 350,
    orchestrationCompletionP95Ms: 5000,
    mttrMinutesMax: 30,
    errorRateFastBurnMax: 0.02,
    errorRateSlowBurnMax: 0.002,
  },
  staging: {
    interactiveLatencyP95Ms: 250,
    orchestrationTtfbP95Ms: 250,
    orchestrationCompletionP95Ms: 4000,
    mttrMinutesMax: 20,
    errorRateFastBurnMax: 0.015,
    errorRateSlowBurnMax: 0.0015,
  },
  production: {},
};

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

export const INTERACTIVE_ROUTE_PREFIXES = ['/health', '/api/health/ready', '/api/teams'] as const;
export const ORCHESTRATION_ROUTE_PREFIXES = ['/api/llm/chat', '/api/billing', '/api/queue'] as const;

export function classifyLatencyClass(route: string): LatencyClass {
  if (ORCHESTRATION_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return 'orchestration';
  }

  if (INTERACTIVE_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return 'interactive';
  }

  return 'interactive';
}

function parseEnvNumber(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getSLOEnvironment(nodeEnv = process.env.NODE_ENV): DeploymentEnvironment {
  if (nodeEnv === 'production') {
    return 'production';
  }

  if (nodeEnv === 'staging') {
    return 'staging';
  }

  return 'development';
}

export function resolveSLOThresholds(
  environment = getSLOEnvironment(),
  env: NodeJS.ProcessEnv = process.env,
): SLOThresholdSet {
  const environmentOverrides = SLO_ENVIRONMENT_OVERRIDES[environment];
  const envPrefix = `SLO_${environment.toUpperCase()}_`;

  const resolved = { ...CANONICAL_SLO_THRESHOLDS, ...environmentOverrides };

  const envOverrides: Partial<SLOThresholdSet> = {
    availabilityTarget:
      parseEnvNumber(env[`${envPrefix}AVAILABILITY_TARGET`]) ?? parseEnvNumber(env.SLO_AVAILABILITY_TARGET),
    interactiveLatencyP95Target:
      parseEnvNumber(env[`${envPrefix}INTERACTIVE_LATENCY_P95_TARGET`]) ??
      parseEnvNumber(env.SLO_INTERACTIVE_LATENCY_P95_TARGET),
    interactiveLatencyP95Ms:
      parseEnvNumber(env[`${envPrefix}INTERACTIVE_LATENCY_P95_MS`]) ??
      parseEnvNumber(env.SLO_INTERACTIVE_LATENCY_P95_MS),
    orchestrationTtfbP95Target:
      parseEnvNumber(env[`${envPrefix}ORCHESTRATION_TTFB_P95_TARGET`]) ??
      parseEnvNumber(env.SLO_ORCHESTRATION_TTFB_P95_TARGET),
    orchestrationTtfbP95Ms:
      parseEnvNumber(env[`${envPrefix}ORCHESTRATION_TTFB_P95_MS`]) ??
      parseEnvNumber(env.SLO_ORCHESTRATION_TTFB_P95_MS),
    orchestrationCompletionP95Target:
      parseEnvNumber(env[`${envPrefix}ORCHESTRATION_COMPLETION_P95_TARGET`]) ??
      parseEnvNumber(env.SLO_ORCHESTRATION_COMPLETION_P95_TARGET),
    orchestrationCompletionP95Ms:
      parseEnvNumber(env[`${envPrefix}ORCHESTRATION_COMPLETION_P95_MS`]) ??
      parseEnvNumber(env.SLO_ORCHESTRATION_COMPLETION_P95_MS),
    authSuccessTarget:
      parseEnvNumber(env[`${envPrefix}AUTH_SUCCESS_TARGET`]) ?? parseEnvNumber(env.SLO_AUTH_SUCCESS_TARGET),
    queueHealthTarget:
      parseEnvNumber(env[`${envPrefix}QUEUE_HEALTH_TARGET`]) ?? parseEnvNumber(env.SLO_QUEUE_HEALTH_TARGET),
    queueDepthMax: parseEnvNumber(env[`${envPrefix}QUEUE_DEPTH_MAX`]) ?? parseEnvNumber(env.SLO_QUEUE_DEPTH_MAX),
    queueOldestAgeSecondsMax:
      parseEnvNumber(env[`${envPrefix}QUEUE_OLDEST_AGE_SECONDS_MAX`]) ??
      parseEnvNumber(env.SLO_QUEUE_OLDEST_AGE_SECONDS_MAX),
    agentColdStartTarget:
      parseEnvNumber(env[`${envPrefix}AGENT_COLD_START_TARGET`]) ?? parseEnvNumber(env.SLO_AGENT_COLD_START_TARGET),
    agentColdStartSecondsMax:
      parseEnvNumber(env[`${envPrefix}AGENT_COLD_START_SECONDS_MAX`]) ??
      parseEnvNumber(env.SLO_AGENT_COLD_START_SECONDS_MAX),
    errorRateFastBurnMax:
      parseEnvNumber(env[`${envPrefix}ERROR_RATE_FAST_BURN_MAX`]) ?? parseEnvNumber(env.SLO_ERROR_RATE_FAST_BURN_MAX),
    errorRateSlowBurnMax:
      parseEnvNumber(env[`${envPrefix}ERROR_RATE_SLOW_BURN_MAX`]) ?? parseEnvNumber(env.SLO_ERROR_RATE_SLOW_BURN_MAX),
    mttrMinutesMax:
      parseEnvNumber(env[`${envPrefix}MTTR_MINUTES_MAX`]) ?? parseEnvNumber(env.SLO_MTTR_MINUTES_MAX),
    burnRateCritical:
      parseEnvNumber(env[`${envPrefix}BURN_RATE_CRITICAL`]) ?? parseEnvNumber(env.SLO_BURN_RATE_CRITICAL),
  };

  return { ...resolved, ...Object.fromEntries(Object.entries(envOverrides).filter(([, value]) => value !== undefined)) } as SLOThresholdSet;
}

const activeThresholds = resolveSLOThresholds('production');

export const PRODUCTION_SLOS: SLO[] = [
  {
    id: 'availability',
    name: 'API Availability',
    description: '99.9% of API requests succeed (non-5xx responses)',
    target: activeThresholds.availabilityTarget,
    window: '30d',
    sli: {
      metric: 'api.availability',
      goodEvents: 'http_requests_total{status!~"5.."}',
      totalEvents: 'http_requests_total',
    },
    errorBudget: {
      remaining: 1 - activeThresholds.availabilityTarget,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - activeThresholds.availabilityTarget) / 2,
    },
  },
  {
    id: 'interactive-latency-p95',
    name: 'Interactive Completion Latency (P95)',
    description: `95% of interactive requests complete within ${activeThresholds.interactiveLatencyP95Ms} milliseconds`,
    target: activeThresholds.interactiveLatencyP95Target,
    window: '30d',
    sli: {
      metric: 'api.interactive_latency_p95',
      goodEvents: `valuecanvas_http_request_duration_ms_bucket{latency_class="interactive",le="${activeThresholds.interactiveLatencyP95Ms}"}`,
      totalEvents: 'valuecanvas_http_requests_total{latency_class="interactive"}',
      threshold: activeThresholds.interactiveLatencyP95Ms,
    },
    errorBudget: {
      remaining: 1 - activeThresholds.interactiveLatencyP95Target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - activeThresholds.interactiveLatencyP95Target) / 2,
    },
  },
  {
    id: 'orchestration-ttfb-p95',
    name: 'Orchestration TTFB (P95)',
    description: `95% of orchestration requests deliver first byte within ${activeThresholds.orchestrationTtfbP95Ms} milliseconds`,
    target: activeThresholds.orchestrationTtfbP95Target,
    window: '30d',
    sli: {
      metric: 'api.orchestration_ttfb_p95',
      goodEvents: `valuecanvas_http_request_ttfb_ms_bucket{latency_class="orchestration",le="${activeThresholds.orchestrationTtfbP95Ms}"}`,
      totalEvents: 'valuecanvas_http_request_ttfb_ms_count{latency_class="orchestration"}',
      threshold: activeThresholds.orchestrationTtfbP95Ms,
    },
    errorBudget: {
      remaining: 1 - activeThresholds.orchestrationTtfbP95Target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - activeThresholds.orchestrationTtfbP95Target) / 2,
    },
  },
  {
    id: 'orchestration-completion-p95',
    name: 'Orchestration Completion Latency (P95)',
    description: `95% of orchestration requests complete within ${activeThresholds.orchestrationCompletionP95Ms} milliseconds`,
    target: activeThresholds.orchestrationCompletionP95Target,
    window: '30d',
    sli: {
      metric: 'api.orchestration_completion_p95',
      goodEvents: `valuecanvas_http_request_duration_ms_bucket{latency_class="orchestration",le="${activeThresholds.orchestrationCompletionP95Ms}"}`,
      totalEvents: 'valuecanvas_http_requests_total{latency_class="orchestration"}',
      threshold: activeThresholds.orchestrationCompletionP95Ms,
    },
    errorBudget: {
      remaining: 1 - activeThresholds.orchestrationCompletionP95Target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - activeThresholds.orchestrationCompletionP95Target) / 2,
    },
  },
  {
    id: 'agent-cold-start',
    name: 'Agent Cold Start',
    description: `95% of agents become ready within ${activeThresholds.agentColdStartSecondsMax} seconds`,
    target: activeThresholds.agentColdStartTarget,
    window: '30d',
    sli: {
      metric: 'agent.cold_start',
      goodEvents: `agent_enqueue_to_ready_seconds_bucket{le=\"${activeThresholds.agentColdStartSecondsMax}\"}`,
      totalEvents: 'agent_enqueue_to_ready_seconds_count',
      threshold: activeThresholds.agentColdStartSecondsMax,
    },
    errorBudget: {
      remaining: 1 - activeThresholds.agentColdStartTarget,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - activeThresholds.agentColdStartTarget) / 2,
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
  {
    id: 'llm-quality',
    name: 'LLM Response Quality',
    description: '90% of LLM responses have confidence > 0.7',
    target: 0.9,
    window: '7d',
    sli: {
      metric: 'llm.quality',
      goodEvents: 'llm_responses_total{confidence>0.7}',
      totalEvents: 'llm_responses_total',
      threshold: 0.7,
    },
    errorBudget: {
      remaining: 0.1,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.05,
    },
  },
  {
    id: 'data-freshness',
    name: 'Data Freshness',
    description: '99% of data updates propagate within 5 seconds',
    target: 0.99,
    window: '7d',
    sli: {
      metric: 'data.freshness',
      goodEvents: 'data_update_latency_seconds < 5',
      totalEvents: 'data_updates_total',
      threshold: 5000,
    },
    errorBudget: {
      remaining: 0.01,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.005,
    },
  },
  {
    id: 'db-query-performance',
    name: 'Database Query Performance',
    description: '99% of database queries complete within 500ms',
    target: 0.99,
    window: '7d',
    sli: {
      metric: 'db.query_performance',
      goodEvents: 'db_query_duration_seconds < 0.5',
      totalEvents: 'db_queries_total',
      threshold: 500,
    },
    errorBudget: {
      remaining: 0.01,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.005,
    },
  },
];

export const BURN_RATE_ALERTS = {
  fast: {
    window: '1h',
    burnRate: activeThresholds.burnRateCritical,
    severity: 'critical' as const,
    description: 'Error budget will be exhausted rapidly at current rate',
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

export function getSLOById(id: string): SLO | undefined {
  return PRODUCTION_SLOS.find((slo) => slo.id === id);
}

export function getSLOsAtRisk(): SLO[] {
  return PRODUCTION_SLOS.filter(isSLOAtRisk);
}

export function validateSLOConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = PRODUCTION_SLOS.map((slo) => slo.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (duplicates.length > 0) {
    errors.push(`Duplicate SLO IDs: ${duplicates.join(', ')}`);
  }

  for (const slo of PRODUCTION_SLOS) {
    if (slo.target < 0 || slo.target > 1) {
      errors.push(`Invalid target for ${slo.id}: ${slo.target} (must be 0-1)`);
    }
  }

  return { valid: errors.length === 0, errors };
}
