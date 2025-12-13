/**
 * Service Level Objectives (SLO) Configuration
 * 
 * Defines SLOs, SLIs, and error budgets for production monitoring
 */

export interface SLO {
  id: string;
  name: string;
  description: string;
  target: number; // Target percentage (0-1)
  window: string; // Time window (e.g., '30d', '7d')
  sli: ServiceLevelIndicator;
  errorBudget: ErrorBudget;
}

export interface ServiceLevelIndicator {
  metric: string;
  goodEvents: string; // Query for good events
  totalEvents: string; // Query for total events
  threshold?: number; // Optional threshold for latency-based SLIs
}

export interface ErrorBudget {
  remaining: number; // Percentage remaining (0-1)
  consumed: number; // Percentage consumed (0-1)
  burnRate: number; // Current burn rate (events/hour)
  alertThreshold: number; // Alert when remaining < threshold (0-1)
}

/**
 * Production SLOs
 */
export const PRODUCTION_SLOS: SLO[] = [
  // Availability SLO
  {
    id: 'availability',
    name: 'API Availability',
    description: '99.9% of API requests succeed (non-5xx responses)',
    target: 0.999, // 99.9%
    window: '30d',
    sli: {
      metric: 'api.availability',
      goodEvents: 'http_requests_total{status!~"5.."}',
      totalEvents: 'http_requests_total'
    },
    errorBudget: {
      remaining: 0.001, // 0.1% error budget
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.0005 // Alert at 50% budget consumed
    }
  },

  // Latency SLO
  {
    id: 'latency-p95',
    name: 'API Latency (P95)',
    description: '95% of API requests complete within 2 seconds',
    target: 0.95,
    window: '30d',
    sli: {
      metric: 'api.latency_p95',
      goodEvents: 'http_request_duration_seconds{quantile="0.95"} < 2',
      totalEvents: 'http_requests_total',
      threshold: 2000 // 2 seconds in milliseconds
    },
    errorBudget: {
      remaining: 0.05, // 5% error budget
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.025 // Alert at 50% budget consumed
    }
  },

  // Agent Success Rate SLO
  {
    id: 'agent-success-rate',
    name: 'Agent Success Rate',
    description: '95% of agent executions succeed without errors',
    target: 0.95,
    window: '7d',
    sli: {
      metric: 'agent.success_rate',
      goodEvents: 'agent_executions_total{status="success"}',
      totalEvents: 'agent_executions_total'
    },
    errorBudget: {
      remaining: 0.05,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.025
    }
  },

  // LLM Response Quality SLO
  {
    id: 'llm-quality',
    name: 'LLM Response Quality',
    description: '90% of LLM responses have confidence > 0.7',
    target: 0.90,
    window: '7d',
    sli: {
      metric: 'llm.quality',
      goodEvents: 'llm_responses_total{confidence>0.7}',
      totalEvents: 'llm_responses_total',
      threshold: 0.7
    },
    errorBudget: {
      remaining: 0.10,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.05
    }
  },

  // Data Freshness SLO
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
      threshold: 5000 // 5 seconds in milliseconds
    },
    errorBudget: {
      remaining: 0.01,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.005
    }
  },

  // Database Query Performance SLO
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
      threshold: 500 // 500ms
    },
    errorBudget: {
      remaining: 0.01,
      consumed: 0,
      burnRate: 0,
      alertThreshold: 0.005
    }
  }
];

/**
 * Calculate error budget consumption
 */
export function calculateErrorBudget(
  goodEvents: number,
  totalEvents: number,
  target: number
): ErrorBudget {
  if (totalEvents === 0) {
    return {
      remaining: 1 - target,
      consumed: 0,
      burnRate: 0,
      alertThreshold: (1 - target) / 2
    };
  }

  const actualSLI = goodEvents / totalEvents;
  const errorBudget = 1 - target;
  const consumed = Math.max(0, target - actualSLI);
  const remaining = Math.max(0, errorBudget - consumed);

  return {
    remaining,
    consumed,
    burnRate: consumed / errorBudget, // Normalized burn rate
    alertThreshold: errorBudget / 2
  };
}

/**
 * Check if SLO is at risk
 */
export function isSLOAtRisk(slo: SLO): boolean {
  return slo.errorBudget.remaining < slo.errorBudget.alertThreshold;
}

/**
 * Get SLO status
 */
export function getSLOStatus(slo: SLO): 'healthy' | 'warning' | 'critical' {
  const { remaining, alertThreshold } = slo.errorBudget;
  
  if (remaining <= 0) {
    return 'critical'; // Error budget exhausted
  } else if (remaining < alertThreshold) {
    return 'warning'; // Error budget at risk
  } else {
    return 'healthy';
  }
}

/**
 * Calculate burn rate alert thresholds
 * Based on Google SRE Workbook multi-window, multi-burn-rate alerts
 */
export const BURN_RATE_ALERTS = {
  // Fast burn (1 hour window, 14.4x burn rate)
  fast: {
    window: '1h',
    burnRate: 14.4,
    severity: 'critical' as const,
    description: 'Error budget will be exhausted in 2 hours at current rate'
  },
  // Medium burn (6 hour window, 6x burn rate)
  medium: {
    window: '6h',
    burnRate: 6,
    severity: 'warning' as const,
    description: 'Error budget will be exhausted in 5 days at current rate'
  },
  // Slow burn (3 day window, 1x burn rate)
  slow: {
    window: '3d',
    burnRate: 1,
    severity: 'info' as const,
    description: 'Error budget consumption on track'
  }
};

/**
 * Get SLO by ID
 */
export function getSLOById(id: string): SLO | undefined {
  return PRODUCTION_SLOS.find(slo => slo.id === id);
}

/**
 * Get all SLOs at risk
 */
export function getSLOsAtRisk(): SLO[] {
  return PRODUCTION_SLOS.filter(isSLOAtRisk);
}

/**
 * Validate SLO configuration
 */
export function validateSLOConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for duplicate IDs
  const ids = PRODUCTION_SLOS.map(s => s.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate SLO IDs: ${duplicates.join(', ')}`);
  }

  // Validate targets
  for (const slo of PRODUCTION_SLOS) {
    if (slo.target < 0 || slo.target > 1) {
      errors.push(`Invalid target for ${slo.id}: ${slo.target} (must be 0-1)`);
    }
  }

  // Validate error budgets
  for (const slo of PRODUCTION_SLOS) {
    const { remaining, consumed, alertThreshold } = slo.errorBudget;
    if (remaining < 0 || remaining > 1) {
      errors.push(`Invalid error budget remaining for ${slo.id}: ${remaining}`);
    }
    if (consumed < 0 || consumed > 1) {
      errors.push(`Invalid error budget consumed for ${slo.id}: ${consumed}`);
    }
    if (alertThreshold < 0 || alertThreshold > 1) {
      errors.push(`Invalid alert threshold for ${slo.id}: ${alertThreshold}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  PRODUCTION_SLOS,
  BURN_RATE_ALERTS,
  calculateErrorBudget,
  isSLOAtRisk,
  getSLOStatus,
  getSLOById,
  getSLOsAtRisk,
  validateSLOConfig
};
