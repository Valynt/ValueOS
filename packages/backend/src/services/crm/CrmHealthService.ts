/**
 * CRM Health Service
 *
 * Provides sync health metrics, alerting thresholds, and observability
 * data for CRM integrations per tenant/provider.
 */

import { z } from 'zod';

import { createLogger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';

import type { CrmProvider } from './types.js';

const logger = createLogger({ component: 'CrmHealthService' });

export interface SyncHealthStatus {
  tenantId: string;
  provider: CrmProvider;
  status: string;
  degraded: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulWebhookAt: string | null;
  lastSuccessfulProcessAt: string | null;
  syncLagSeconds: number | null;
  tokenHealth: 'valid' | 'expiring_soon' | 'expired';
  errorRate1h: number;
  webhookThroughput1h: number;
  consecutiveFailureCount: number;
  mttrSeconds: number | null;
  mttrSampleSize: number;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  level: 'warning' | 'critical';
  code: string;
  message: string;
}

export interface HealthTimelineEvent {
  id: string;
  provider: CrmProvider;
  type: 'incident_started' | 'incident_recovered';
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  severity: 'warning' | 'critical';
  reasonCode: string;
  summary: string;
}

export interface SloStatus {
  status: 'healthy' | 'warning' | 'critical';
  targetMttrSeconds: number;
  currentMttrSeconds: number | null;
  maxConsecutiveFailures: number;
  consecutiveFailureCount: number;
}

export interface ProviderHealthTimeline {
  provider: CrmProvider;
  current: SyncHealthStatus | null;
  slo: SloStatus;
  timeline: HealthTimelineEvent[];
}

export interface TenantHealthTimelineResponse {
  tenantId: string;
  generatedAt: string;
  providers: ProviderHealthTimeline[];
}

const HealthAlertSchema = z.object({
  level: z.enum(['warning', 'critical']),
  code: z.string(),
  message: z.string(),
});

const SyncHealthStatusSchema = z.object({
  tenantId: z.string(),
  provider: z.enum(['salesforce', 'hubspot']),
  status: z.string(),
  degraded: z.boolean(),
  lastSyncAt: z.string().nullable(),
  lastSuccessfulSyncAt: z.string().nullable(),
  lastSuccessfulWebhookAt: z.string().nullable(),
  lastSuccessfulProcessAt: z.string().nullable(),
  syncLagSeconds: z.number().nullable(),
  tokenHealth: z.enum(['valid', 'expiring_soon', 'expired']),
  errorRate1h: z.number(),
  webhookThroughput1h: z.number(),
  consecutiveFailureCount: z.number(),
  mttrSeconds: z.number().nullable(),
  mttrSampleSize: z.number(),
  alerts: z.array(HealthAlertSchema),
});

const HealthTimelineEventSchema = z.object({
  id: z.string(),
  provider: z.enum(['salesforce', 'hubspot']),
  type: z.enum(['incident_started', 'incident_recovered']),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  severity: z.enum(['warning', 'critical']),
  reasonCode: z.string(),
  summary: z.string(),
});

const SloStatusSchema = z.object({
  status: z.enum(['healthy', 'warning', 'critical']),
  targetMttrSeconds: z.number(),
  currentMttrSeconds: z.number().nullable(),
  maxConsecutiveFailures: z.number(),
  consecutiveFailureCount: z.number(),
});

export const TenantHealthTimelineResponseSchema = z.object({
  tenantId: z.string(),
  generatedAt: z.string(),
  providers: z.array(
    z.object({
      provider: z.enum(['salesforce', 'hubspot']),
      current: SyncHealthStatusSchema.nullable(),
      slo: SloStatusSchema,
      timeline: z.array(HealthTimelineEventSchema),
    }),
  ),
});

// Alerting thresholds
const SYNC_LAG_WARNING_SECONDS = 3600; // 1 hour
const SYNC_LAG_CRITICAL_SECONDS = 14400; // 4 hours
const ERROR_RATE_WARNING = 5;
const ERROR_RATE_CRITICAL = 20;
const CONSECUTIVE_FAILURE_WARNING = 3;
const CONSECUTIVE_FAILURE_CRITICAL = 5;
const MTTR_TARGET_SECONDS = 1800; // 30 minutes

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
      tenantId: String(data.tenant_id),
      provider: data.provider as CrmProvider,
      status: String(data.status),
      degraded: Boolean(data.degraded),
      lastSyncAt: this.readNullableTimestamp(data.last_sync_at),
      lastSuccessfulSyncAt: this.readNullableTimestamp(data.last_successful_sync_at),
      lastSuccessfulWebhookAt: this.readNullableTimestamp(data.last_successful_webhook_at),
      lastSuccessfulProcessAt: this.readNullableTimestamp(data.last_successful_process_at),
      syncLagSeconds: this.readNullableNumber(data.sync_lag_seconds),
      tokenHealth: this.readTokenHealth(data.token_health),
      errorRate1h: this.readNumber(data.error_rate_1h),
      webhookThroughput1h: this.readNumber(data.webhook_throughput_1h),
      consecutiveFailureCount: this.readNumber(data.consecutive_failure_count),
      mttrSeconds: this.readNullableNumber(data.mttr_seconds),
      mttrSampleSize: this.readNumber(data.mttr_sample_size),
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
      tenantId: String(row.tenant_id),
      provider: row.provider as CrmProvider,
      status: String(row.status),
      degraded: Boolean(row.degraded),
      lastSyncAt: this.readNullableTimestamp(row.last_sync_at),
      lastSuccessfulSyncAt: this.readNullableTimestamp(row.last_successful_sync_at),
      lastSuccessfulWebhookAt: this.readNullableTimestamp(row.last_successful_webhook_at),
      lastSuccessfulProcessAt: this.readNullableTimestamp(row.last_successful_process_at),
      syncLagSeconds: this.readNullableNumber(row.sync_lag_seconds),
      tokenHealth: this.readTokenHealth(row.token_health),
      errorRate1h: this.readNumber(row.error_rate_1h),
      webhookThroughput1h: this.readNumber(row.webhook_throughput_1h),
      consecutiveFailureCount: this.readNumber(row.consecutive_failure_count),
      mttrSeconds: this.readNullableNumber(row.mttr_seconds),
      mttrSampleSize: this.readNumber(row.mttr_sample_size),
      alerts: this.computeAlerts(row),
    }));
  }

  async getHealthTimeline(tenantId: string, lookbackDays = 14): Promise<TenantHealthTimelineResponse> {
    const healthByProvider = new Map<CrmProvider, SyncHealthStatus>();
    for (const health of await this.getAllHealth(tenantId)) {
      healthByProvider.set(health.provider, health);
    }

    const startedAfter = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000)).toISOString();
    const { data: incidents, error } = await this.supabase
      .from('crm_health_incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('started_at', startedAfter)
      .order('started_at', { ascending: false })
      .limit(200);

    if (error) {
      logger.warn('Failed to load CRM health incidents', { tenantId, error: error.message });
    }

    const timelineByProvider = new Map<CrmProvider, HealthTimelineEvent[]>();
    for (const incident of incidents ?? []) {
      const provider = incident.provider as CrmProvider;
      const base = {
        id: String(incident.id),
        provider,
        startedAt: String(incident.started_at),
        resolvedAt: this.readNullableTimestamp(incident.resolved_at),
        durationSeconds: this.readNullableNumber(incident.duration_seconds),
        severity: this.readSeverity(incident.severity),
        reasonCode: String(incident.reason_code ?? 'unknown'),
        summary: String(incident.summary ?? 'CRM integration incident'),
      } satisfies Omit<HealthTimelineEvent, 'type'>;

      const events: HealthTimelineEvent[] = [{ ...base, type: 'incident_started' }];
      if (base.resolvedAt) {
        events.push({ ...base, type: 'incident_recovered' });
      }

      const existing = timelineByProvider.get(provider) ?? [];
      timelineByProvider.set(provider, existing.concat(events));
    }

    const providers: CrmProvider[] = ['salesforce', 'hubspot'];
    const response: TenantHealthTimelineResponse = {
      tenantId,
      generatedAt: new Date().toISOString(),
      providers: providers.map((provider) => {
        const current = healthByProvider.get(provider) ?? null;
        const timeline = (timelineByProvider.get(provider) ?? [])
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, 20);

        const slo: SloStatus = {
          status: this.deriveSloStatus(current),
          targetMttrSeconds: MTTR_TARGET_SECONDS,
          currentMttrSeconds: current?.mttrSeconds ?? null,
          maxConsecutiveFailures: CONSECUTIVE_FAILURE_CRITICAL,
          consecutiveFailureCount: current?.consecutiveFailureCount ?? 0,
        };

        return { provider, current, slo, timeline };
      }),
    };

    return TenantHealthTimelineResponseSchema.parse(response);
  }

  private computeAlerts(data: Record<string, unknown>): HealthAlert[] {
    const alerts: HealthAlert[] = [];

    const syncLagSeconds = this.readNullableNumber(data.sync_lag_seconds);
    const errorRate1h = this.readNumber(data.error_rate_1h);
    const consecutiveFailureCount = this.readNumber(data.consecutive_failure_count);
    const tokenHealth = this.readTokenHealth(data.token_health);
    const status = String(data.status ?? 'unknown');

    // Sync lag alerts
    if (syncLagSeconds != null) {
      if (syncLagSeconds >= SYNC_LAG_CRITICAL_SECONDS) {
        alerts.push({
          level: 'critical',
          code: 'SYNC_LAG_CRITICAL',
          message: `Sync lag is ${Math.round(syncLagSeconds / 3600)}h (threshold: ${SYNC_LAG_CRITICAL_SECONDS / 3600}h)`,
        });
      } else if (syncLagSeconds >= SYNC_LAG_WARNING_SECONDS) {
        alerts.push({
          level: 'warning',
          code: 'SYNC_LAG_WARNING',
          message: `Sync lag is ${Math.round(syncLagSeconds / 60)}min (threshold: ${SYNC_LAG_WARNING_SECONDS / 60}min)`,
        });
      }
    }

    // Token health
    if (tokenHealth === 'expired') {
      alerts.push({
        level: 'critical',
        code: 'TOKEN_EXPIRED',
        message: 'OAuth token has expired. Re-authentication required.',
      });
    } else if (tokenHealth === 'expiring_soon') {
      alerts.push({
        level: 'warning',
        code: 'TOKEN_EXPIRING',
        message: 'OAuth token expires within 1 hour.',
      });
    }

    // Error rate
    if (errorRate1h >= ERROR_RATE_CRITICAL) {
      alerts.push({
        level: 'critical',
        code: 'ERROR_RATE_CRITICAL',
        message: `${errorRate1h} webhook failures in the last hour`,
      });
    } else if (errorRate1h >= ERROR_RATE_WARNING) {
      alerts.push({
        level: 'warning',
        code: 'ERROR_RATE_WARNING',
        message: `${errorRate1h} webhook failures in the last hour`,
      });
    }

    if (consecutiveFailureCount >= CONSECUTIVE_FAILURE_CRITICAL) {
      alerts.push({
        level: 'critical',
        code: 'CONSECUTIVE_FAILURES_CRITICAL',
        message: `${consecutiveFailureCount} consecutive failures detected`,
      });
    } else if (consecutiveFailureCount >= CONSECUTIVE_FAILURE_WARNING) {
      alerts.push({
        level: 'warning',
        code: 'CONSECUTIVE_FAILURES_WARNING',
        message: `${consecutiveFailureCount} consecutive failures detected`,
      });
    }

    // Connection status
    if (status === 'error') {
      alerts.push({
        level: 'critical',
        code: 'CONNECTION_ERROR',
        message: 'CRM connection is in error state.',
      });
    } else if (status === 'degraded') {
      alerts.push({
        level: 'warning',
        code: 'CONNECTION_DEGRADED',
        message: 'CRM connection is degraded.',
      });
    }

    return alerts;
  }

  private deriveSloStatus(current: SyncHealthStatus | null): 'healthy' | 'warning' | 'critical' {
    if (!current) return 'healthy';

    if (current.consecutiveFailureCount >= CONSECUTIVE_FAILURE_CRITICAL) {
      return 'critical';
    }

    if (current.mttrSeconds != null && current.mttrSeconds > MTTR_TARGET_SECONDS) {
      return 'warning';
    }

    if (current.degraded) {
      return 'warning';
    }

    return 'healthy';
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' ? value : 0;
  }

  private readNullableNumber(value: unknown): number | null {
    return typeof value === 'number' ? value : null;
  }

  private readNullableTimestamp(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private readTokenHealth(value: unknown): 'valid' | 'expiring_soon' | 'expired' {
    if (value === 'expired' || value === 'expiring_soon') return value;
    return 'valid';
  }

  private readSeverity(value: unknown): 'warning' | 'critical' {
    if (value === 'critical') return 'critical';
    return 'warning';
  }
}

export const crmHealthService = new CrmHealthService();
