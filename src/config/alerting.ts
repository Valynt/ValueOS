/**
 * Alerting Configuration
 * 
 * Defines alert rules and thresholds for monitoring
 */

import { AlertRule } from '../services/AlertingService';

/**
 * Alert thresholds configuration
 */
export const ALERT_THRESHOLDS = {
  // Agent Performance
  AGENT_ERROR_RATE_WARNING: 0.05,      // 5%
  AGENT_ERROR_RATE_CRITICAL: 0.10,     // 10%
  HALLUCINATION_RATE_WARNING: 0.15,    // 15%
  HALLUCINATION_RATE_CRITICAL: 0.25,   // 25%
  LOW_CONFIDENCE_RATE_WARNING: 0.30,   // 30%
  
  // Response Times (milliseconds)
  P95_RESPONSE_TIME_WARNING: 5000,     // 5 seconds
  P99_RESPONSE_TIME_CRITICAL: 10000,   // 10 seconds
  
  // LLM Costs (USD per hour)
  LLM_HOURLY_COST_WARNING: 10,         // $10/hour
  LLM_HOURLY_COST_CRITICAL: 50,        // $50/hour
  
  // Cache Performance
  CACHE_HIT_RATE_WARNING: 0.50,        // 50%
  
  // Confidence Scores
  MIN_CONFIDENCE_SCORE: 0.60,          // 60%
  
  // Prediction Accuracy
  MIN_PREDICTION_ACCURACY: 0.70,       // 70%
} as const;

/**
 * Alert check intervals (minutes)
 */
export const ALERT_CHECK_INTERVALS = {
  HIGH_FREQUENCY: 5,      // Every 5 minutes
  MEDIUM_FREQUENCY: 10,   // Every 10 minutes
  LOW_FREQUENCY: 15,      // Every 15 minutes
  HOURLY: 60,             // Every hour
} as const;

/**
 * Notification channels configuration
 */
export const NOTIFICATION_CHANNELS = {
  CRITICAL: ['sentry', 'email', 'webhook'] as const,
  WARNING: ['sentry'] as const,
  INFO: ['sentry'] as const,
} as const;

/**
 * Alert rules configuration
 */
export const ALERT_RULES: AlertRule[] = [
  // Agent Performance Alerts
  {
    id: 'high-error-rate',
    name: 'High Agent Error Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.error_rate',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.AGENT_ERROR_RATE_WARNING,
        severity: 'warning',
        description: `Agent error rate exceeds ${ALERT_THRESHOLDS.AGENT_ERROR_RATE_WARNING * 100}%`
      },
      {
        metricName: 'agent.error_rate',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.AGENT_ERROR_RATE_CRITICAL,
        severity: 'critical',
        description: `Agent error rate exceeds ${ALERT_THRESHOLDS.AGENT_ERROR_RATE_CRITICAL * 100}%`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.HIGH_FREQUENCY,
    notificationChannels: ['sentry', 'email']
  },
  
  {
    id: 'high-hallucination-rate',
    name: 'High Hallucination Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.hallucination_rate',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.HALLUCINATION_RATE_WARNING,
        severity: 'warning',
        description: `Hallucination rate exceeds ${ALERT_THRESHOLDS.HALLUCINATION_RATE_WARNING * 100}%`
      },
      {
        metricName: 'agent.hallucination_rate',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.HALLUCINATION_RATE_CRITICAL,
        severity: 'critical',
        description: `Hallucination rate exceeds ${ALERT_THRESHOLDS.HALLUCINATION_RATE_CRITICAL * 100}%`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.MEDIUM_FREQUENCY,
    notificationChannels: ['sentry']
  },
  
  {
    id: 'low-confidence',
    name: 'High Low Confidence Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.low_confidence_rate',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.LOW_CONFIDENCE_RATE_WARNING,
        severity: 'warning',
        description: `Low confidence rate exceeds ${ALERT_THRESHOLDS.LOW_CONFIDENCE_RATE_WARNING * 100}%`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.LOW_FREQUENCY,
    notificationChannels: ['sentry']
  },
  
  // Performance Alerts
  {
    id: 'slow-response-time',
    name: 'Slow Agent Response Time',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.p95_response_time',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.P95_RESPONSE_TIME_WARNING,
        severity: 'warning',
        description: `P95 response time exceeds ${ALERT_THRESHOLDS.P95_RESPONSE_TIME_WARNING}ms`
      },
      {
        metricName: 'agent.p99_response_time',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.P99_RESPONSE_TIME_CRITICAL,
        severity: 'critical',
        description: `P99 response time exceeds ${ALERT_THRESHOLDS.P99_RESPONSE_TIME_CRITICAL}ms`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.HIGH_FREQUENCY,
    notificationChannels: ['sentry']
  },
  
  // Cost Alerts
  {
    id: 'high-llm-cost',
    name: 'High LLM Cost',
    enabled: true,
    thresholds: [
      {
        metricName: 'llm.hourly_cost',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.LLM_HOURLY_COST_WARNING,
        severity: 'warning',
        description: `LLM cost exceeds $${ALERT_THRESHOLDS.LLM_HOURLY_COST_WARNING}/hour`
      },
      {
        metricName: 'llm.hourly_cost',
        operator: 'gt',
        threshold: ALERT_THRESHOLDS.LLM_HOURLY_COST_CRITICAL,
        severity: 'critical',
        description: `LLM cost exceeds $${ALERT_THRESHOLDS.LLM_HOURLY_COST_CRITICAL}/hour`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.LOW_FREQUENCY,
    notificationChannels: ['sentry', 'email']
  },
  
  // Cache Performance
  {
    id: 'low-cache-hit-rate',
    name: 'Low Cache Hit Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'cache.hit_rate',
        operator: 'lt',
        threshold: ALERT_THRESHOLDS.CACHE_HIT_RATE_WARNING,
        severity: 'warning',
        description: `Cache hit rate below ${ALERT_THRESHOLDS.CACHE_HIT_RATE_WARNING * 100}%`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.HOURLY,
    notificationChannels: ['sentry']
  },
  
  // Prediction Accuracy
  {
    id: 'low-prediction-accuracy',
    name: 'Low Value Prediction Accuracy',
    enabled: true,
    thresholds: [
      {
        metricName: 'prediction.accuracy',
        operator: 'lt',
        threshold: ALERT_THRESHOLDS.MIN_PREDICTION_ACCURACY,
        severity: 'warning',
        description: `Prediction accuracy below ${ALERT_THRESHOLDS.MIN_PREDICTION_ACCURACY * 100}%`
      }
    ],
    checkIntervalMinutes: ALERT_CHECK_INTERVALS.HOURLY,
    notificationChannels: ['sentry', 'email']
  }
];

/**
 * Get alert rules by severity
 */
export function getAlertRulesBySeverity(severity: 'info' | 'warning' | 'critical'): AlertRule[] {
  return ALERT_RULES.filter(rule =>
    rule.thresholds.some(t =\u003e t.severity === severity)
  );
}

/**
 * Get enabled alert rules
 */
export function getEnabledAlertRules(): AlertRule[] {
  return ALERT_RULES.filter(rule =\u003e rule.enabled);
}

/**
 * Get alert rule by ID
 */
export function getAlertRuleById(id: string): AlertRule | undefined {
  return ALERT_RULES.find(rule =\u003e rule.id === id);
}

/**
 * Validate alert configuration
 */
export function validateAlertConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for duplicate IDs
  const ids = ALERT_RULES.map(r =\u003e r.id);
  const duplicates = ids.filter((id, index) =\u003e ids.indexOf(id) !== index);
  if (duplicates.length \u003e 0) {
    errors.push(`Duplicate alert rule IDs: ${duplicates.join(', ')}`);
  }
  
  // Check threshold values
  for (const rule of ALERT_RULES) {
    for (const threshold of rule.thresholds) {
      if (threshold.threshold \u003c 0) {
        errors.push(`Invalid threshold value for ${rule.id}: ${threshold.threshold}`);
      }
    }
  }
  
  // Check check intervals
  for (const rule of ALERT_RULES) {
    if (rule.checkIntervalMinutes \u003c 1) {
      errors.push(`Invalid check interval for ${rule.id}: ${rule.checkIntervalMinutes}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Environment-specific overrides
 */
export function getAlertConfigForEnvironment(env: 'development' | 'staging' | 'production'): typeof ALERT_THRESHOLDS {
  switch (env) {
    case 'development':
      return {
        ...ALERT_THRESHOLDS,
        // More lenient thresholds for development
        AGENT_ERROR_RATE_WARNING: 0.20,
        AGENT_ERROR_RATE_CRITICAL: 0.50,
        HALLUCINATION_RATE_WARNING: 0.30,
        HALLUCINATION_RATE_CRITICAL: 0.50,
      };
    
    case 'staging':
      return {
        ...ALERT_THRESHOLDS,
        // Slightly more lenient for staging
        AGENT_ERROR_RATE_WARNING: 0.10,
        AGENT_ERROR_RATE_CRITICAL: 0.20,
      };
    
    case 'production':
    default:
      return ALERT_THRESHOLDS;
  }
}

export default {
  ALERT_THRESHOLDS,
  ALERT_CHECK_INTERVALS,
  NOTIFICATION_CHANNELS,
  ALERT_RULES,
  getAlertRulesBySeverity,
  getEnabledAlertRules,
  getAlertRuleById,
  validateAlertConfig,
  getAlertConfigForEnvironment
};
