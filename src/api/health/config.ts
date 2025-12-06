/**
 * Configuration Health Check
 * 
 * Provides a health check utility for verifying configuration status
 * without exposing sensitive values.
 * 
 * Usage:
 * - Call getConfigHealth() to get current status
 * - Useful for debugging, monitoring, and startup verification
 */

import { validateLLMConfig } from '../../config/validateEnv';
import { getConfig } from '../../config/environment';
import { createLogger } from '../../lib/logger';

const healthLogger = createLogger({ component: 'ConfigHealth' });
import type { HealthStatus, ComponentHealth, ConfigHealth } from '../../types/health';

/**
 * Get environment variable safely (without exposing value)
 */
function isEnvConfigured(key: string): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return Boolean((import.meta as any).env[key]);
  }
  if (typeof process !== 'undefined' && process.env) {
    return Boolean(process.env[key]);
  }
  return false;
}

/**
 * Check LLM health
 */
function checkLLMHealth(): ComponentHealth & {
  provider: string;
  gating_enabled: boolean;
  provider_available: boolean;
} {
  const llmValidation = validateLLMConfig();
  const { provider, gatingEnabled, providerAvailable } = llmValidation;

  let status: HealthStatus = 'healthy';
  let message: string | undefined;

  if (!llmValidation.valid) {
    status = 'unhealthy';
    message = `${llmValidation.errors.length} error(s)`;
  } else if (llmValidation.warnings.length > 0) {
    status = 'degraded';
    message = `${llmValidation.warnings.length} warning(s)`;
  }

  return {
    status,
    message,
    available: providerAvailable,
    provider,
    gating_enabled: gatingEnabled,
    provider_available: providerAvailable,
  };
}

/**
 * Check Supabase health
 */
function checkSupabaseHealth(): ComponentHealth & {
  url_configured: boolean;
  anon_key_configured: boolean;
} {
  const urlConfigured = isEnvConfigured('VITE_SUPABASE_URL');
  const anonKeyConfigured = isEnvConfigured('VITE_SUPABASE_ANON_KEY');
  const available = urlConfigured && anonKeyConfigured;

  let status: HealthStatus = 'healthy';
  let message: string | undefined;

  if (!urlConfigured || !anonKeyConfigured) {
    status = 'degraded';
    const missing: string[] = [];
    if (!urlConfigured) missing.push('URL');
    if (!anonKeyConfigured) missing.push('ANON_KEY');
    message = `Missing: ${missing.join(', ')}`;
  }

  return {
    status,
    message,
    available,
    url_configured: urlConfigured,
    anon_key_configured: anonKeyConfigured,
  };
}

/**
 * Check Redis health
 */
function checkRedisHealth(): ComponentHealth & {
  enabled: boolean;
  url_configured: boolean;
} {
  const config = getConfig();
  const enabled = config.cache.enabled;
  const urlConfigured = isEnvConfigured('REDIS_URL');

  let status: HealthStatus = 'healthy';
  let message: string | undefined;

  if (enabled && !urlConfigured) {
    status = 'degraded';
    message = 'Enabled but URL not configured';
  }

  return {
    status,
    message,
    available: enabled && urlConfigured,
    enabled,
    url_configured: urlConfigured,
  };
}

/**
 * Check monitoring health
 */
function checkMonitoringHealth(): ComponentHealth & {
  sentry_enabled: boolean;
} {
  const config = getConfig();
  const sentryEnabled = config.monitoring.sentry.enabled;
  const sentryDsnConfigured = isEnvConfigured('VITE_SENTRY_DSN');

  let status: HealthStatus = 'healthy';
  let message: string | undefined;

  if (sentryEnabled && !sentryDsnConfigured) {
    status = 'degraded';
    message = 'Sentry enabled but DSN not configured';
  }

  return {
    status,
    message,
    available: sentryEnabled && sentryDsnConfigured,
    sentry_enabled: sentryEnabled,
  };
}

/**
 * Get overall configuration health
 */
export function getConfigHealth(): ConfigHealth {
  const llmHealth = checkLLMHealth();
  const supabaseHealth = checkSupabaseHealth();
  const redisHealth = checkRedisHealth();
  const monitoringHealth = checkMonitoringHealth();

  // Determine overall status
  const statuses = [
    llmHealth.status,
    supabaseHealth.status,
    redisHealth.status,
    monitoringHealth.status,
  ];

  let overallStatus: HealthStatus = 'healthy';
  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }

  // Get validation summary
  const llmValidation = validateLLMConfig();

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components: {
      llm: llmHealth,
      supabase: supabaseHealth,
      redis: redisHealth,
      monitoring: monitoringHealth,
    },
    validation: {
      errors: llmValidation.errors.length,
      warnings: llmValidation.warnings.length,
    },
  };
}

/**
 * Log configuration health to console
 */
export function logConfigHealth(): void {
  const health = getConfigHealth();

  const componentStatus = Object.entries(health.components).map(([name, component]) => ({
    component: name,
    status: component.status,
    available: component.available,
    message: component.message,
  }));

  healthLogger.info('Configuration health snapshot', {
    status: health.status,
    timestamp: health.timestamp,
    components: componentStatus,
    validation: health.validation,
  });
}

/**
 * Get configuration health as JSON (for API endpoints)
 */
export function getConfigHealthJSON(): string {
  return JSON.stringify(getConfigHealth(), null, 2);
}
