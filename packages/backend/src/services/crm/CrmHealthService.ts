/**
 * CRM Health Service
 *
 * Provides sync health metrics, alerting thresholds, and observability
 * data for CRM integrations per tenant/provider.
 */

import { createLogger } from '../../lib/logger.js';
import { createServerSupabaseClient } from '../../lib/supabase.js';

import type { CrmProvider } from './types.js';

const logger = createLogger({ component: 'CrmHealthService' });

export interface SyncHealthStatus {
  tenantId: string;
  provider: CrmProvider;
  status: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncLagSeconds: number | null;
  tokenHealth: 'valid' | 'expiring_soon' | 'expired';
  errorRate1h: number;
  webhookThroughput1h: number;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  level: 'warning' | 'critical';
  code: string;
  message: string;
}

// Alerting thresholds
const SYNC_LAG_WARNING_SECONDS = 3600;      // 1 hour
const SYNC_LAG_CRITICAL_SECONDS = 14400;    // 4 hours
const ERROR_RATE_WARNING = 5;
const ERROR_RATE_CRITICAL = 20;

export class CrmHealthService {
  private supabase = createServerSupabaseClient();

  /**
   * Get sync health for a specific tenant/provider.
   */
  async getHealth(tenantId: string, provider: CrmProvider): Promise<SyncHealthStatus | null> {
    const { data, error } = await this.supabase
      .from('crm_sync_health')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle();

    if (error || !data) return null;

    const alerts = this.computeAlerts(data);

    return {
      tenantId: data.tenant_id,
      provider: data.provider,
      status: data.status,
      lastSyncAt: data.last_sync_at,
      lastSuccessfulSyncAt: data.last_successful_sync_at,
      syncLagSeconds: data.sync_lag_seconds,
      tokenHealth: data.token_health,
      errorRate1h: data.error_rate_1h,
      webhookThroughput1h: data.webhook_throughput_1h,
      alerts,
    };
  }

  /**
   * Get sync health for all connections of a tenant.
   */
  async getAllHealth(tenantId: string): Promise<SyncHealthStatus[]> {
    const { data, error } = await this.supabase
      .from('crm_sync_health')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      tenantId: row.tenant_id,
      provider: row.provider,
      status: row.status,
      lastSyncAt: row.last_sync_at,
      lastSuccessfulSyncAt: row.last_successful_sync_at,
      syncLagSeconds: row.sync_lag_seconds,
      tokenHealth: row.token_health,
      errorRate1h: row.error_rate_1h,
      webhookThroughput1h: row.webhook_throughput_1h,
      alerts: this.computeAlerts(row),
    }));
  }

  private computeAlerts(data: Record<string, unknown>): HealthAlert[] {
    const alerts: HealthAlert[] = [];

    // Sync lag alerts
    if (data.sync_lag_seconds != null) {
      if (data.sync_lag_seconds >= SYNC_LAG_CRITICAL_SECONDS) {
        alerts.push({
          level: 'critical',
          code: 'SYNC_LAG_CRITICAL',
          message: `Sync lag is ${Math.round(data.sync_lag_seconds / 3600)}h (threshold: ${SYNC_LAG_CRITICAL_SECONDS / 3600}h)`,
        });
      } else if (data.sync_lag_seconds >= SYNC_LAG_WARNING_SECONDS) {
        alerts.push({
          level: 'warning',
          code: 'SYNC_LAG_WARNING',
          message: `Sync lag is ${Math.round(data.sync_lag_seconds / 60)}min (threshold: ${SYNC_LAG_WARNING_SECONDS / 60}min)`,
        });
      }
    }

    // Token health
    if (data.token_health === 'expired') {
      alerts.push({
        level: 'critical',
        code: 'TOKEN_EXPIRED',
        message: 'OAuth token has expired. Re-authentication required.',
      });
    } else if (data.token_health === 'expiring_soon') {
      alerts.push({
        level: 'warning',
        code: 'TOKEN_EXPIRING',
        message: 'OAuth token expires within 1 hour.',
      });
    }

    // Error rate
    if (data.error_rate_1h >= ERROR_RATE_CRITICAL) {
      alerts.push({
        level: 'critical',
        code: 'ERROR_RATE_CRITICAL',
        message: `${data.error_rate_1h} webhook failures in the last hour`,
      });
    } else if (data.error_rate_1h >= ERROR_RATE_WARNING) {
      alerts.push({
        level: 'warning',
        code: 'ERROR_RATE_WARNING',
        message: `${data.error_rate_1h} webhook failures in the last hour`,
      });
    }

    // Connection status
    if (data.status === 'error') {
      alerts.push({
        level: 'critical',
        code: 'CONNECTION_ERROR',
        message: 'CRM connection is in error state.',
      });
    }

    return alerts;
  }
}

export const crmHealthService = new CrmHealthService();
