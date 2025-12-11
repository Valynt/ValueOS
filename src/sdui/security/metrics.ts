/**
 * SDUI Security Metrics
 * 
 * Tracks security-related events for monitoring and alerting.
 */

import { logger } from '../../lib/logger';

/**
 * Security event types
 */
export type SecurityEventType =
  | 'xss_blocked'
  | 'rate_limit_hit'
  | 'tenant_violation'
  | 'recursion_limit'
  | 'invalid_schema'
  | 'component_not_found'
  | 'binding_error'
  | 'session_invalid';

/**
 * Security metric counters
 */
interface SecurityMetrics {
  xssBlocked: number;
  rateLimitHits: number;
  tenantViolations: number;
  recursionLimits: number;
  invalidSchemas: number;
  componentNotFound: number;
  bindingErrors: number;
  sessionInvalid: number;
}

/**
 * Metric tracking
 */
let metrics: SecurityMetrics = {
  xssBlocked: 0,
  rateLimitHits: 0,
  tenantViolations: 0,
  recursionLimits: 0,
  invalidSchemas: 0,
  componentNotFound: 0,
  bindingErrors: 0,
  sessionInvalid: 0,
};

let lastResetTime = Date.now();

/**
 * Increment a security metric
 */
export function incrementSecurityMetric(
  event: SecurityEventType,
  metadata?: Record<string, unknown>
): void {
  // Map event type to metric
  const metricMap: Record<SecurityEventType, keyof SecurityMetrics> = {
    xss_blocked: 'xssBlocked',
    rate_limit_hit: 'rateLimitHits',
    tenant_violation: 'tenantViolations',
    recursion_limit: 'recursionLimits',
    invalid_schema: 'invalidSchemas',
    component_not_found: 'componentNotFound',
    binding_error: 'bindingErrors',
    session_invalid: 'sessionInvalid',
  };
  
  const metricKey = metricMap[event];
  metrics[metricKey]++;
  
  // Log security event
  logger.warn(`Security event: ${event}`, {
    event,
    count: metrics[metricKey],
    metadata,
  });
  
  // Alert on critical thresholds
  if (event === 'xss_blocked' && metrics.xssBlocked % 10 === 0) {
    logger.error('High XSS attempt rate detected', new Error('Security Alert'), {
      xssBlocked: metrics.xssBlocked,
      sinceMinutes: (Date.now() - lastResetTime) / 60000,
    });
  }
  
  if (event === 'tenant_violation') {
    logger.error('Tenant isolation violation detected', new Error('Security Critical'), {
      tenantViolations: metrics.tenantViolations,
      metadata,
    });
  }
}

/**
 * Get current security metrics
 */
export function getSecurityMetrics(): SecurityMetrics & { sinceTimestamp: number } {
  return {
    ...metrics,
    sinceTimestamp: lastResetTime,
  };
}

/**
 * Reset security metrics (called by monitoring system)
 */
export function resetSecurityMetrics(): void {
  metrics = {
    xssBlocked: 0,
    rateLimitHits: 0,
    tenantViolations: 0,
    recursionLimits: 0,
    invalidSchemas: 0,
    componentNotFound: 0,
    bindingErrors: 0,
    sessionInvalid: 0,
  };
  lastResetTime = Date.now();
}

/**
 * Get metric summary for monitoring dashboard
 */
export function getMetricSummary(): string {
  const elapsed = (Date.now() - lastResetTime) / 60000;
  return `
Security Metrics (last ${elapsed.toFixed(1)} minutes):
- XSS Blocked: ${metrics.xssBlocked}
- Rate Limits: ${metrics.rateLimitHits}
- Tenant Violations: ${metrics.tenantViolations}
- Recursion Limits: ${metrics.recursionLimits}
- Invalid Schemas: ${metrics.invalidSchemas}
- Component Not Found: ${metrics.componentNotFound}
- Binding Errors: ${metrics.bindingErrors}
- Session Invalid: ${metrics.sessionInvalid}
  `.trim();
}

/**
 * Check if any critical thresholds are exceeded
 */
export function checkCriticalThresholds(): { critical: boolean; alerts: string[] } {
  const alerts: string[] = [];
  let critical = false;
  
  // Any tenant violation is critical
  if (metrics.tenantViolations > 0) {
    critical = true;
    alerts.push(`CRITICAL: ${metrics.tenantViolations} tenant isolation violations detected`);
  }
  
  // High XSS attempt rate
  if (metrics.xssBlocked > 50) {
    critical = true;
    alerts.push(`CRITICAL: ${metrics.xssBlocked} XSS attempts blocked - possible attack`);
  }
  
  // High rate limit hits
  if (metrics.rateLimitHits > 100) {
    alerts.push(`WARNING: ${metrics.rateLimitHits} rate limit hits - possible DoS attempt`);
  }
  
  // High recursion limit hits
  if (metrics.recursionLimits > 10) {
    alerts.push(`WARNING: ${metrics.recursionLimits} recursion limits hit - check schemas`);
  }
  
  return { critical, alerts };
}
