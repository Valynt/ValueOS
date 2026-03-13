import { logger } from "../../lib/logger.js";
import { siemExportForwarderService, type SiemSource } from "./SiemExportForwarderService.js";

export type SecurityEventCategory =
  | "auth"
  | "authorization"
  | "role_change"
  | "data_export"
  | "policy"
  | "audit"
  | "anomaly";

export interface NormalizedSecurityEvent {
  event_id: string;
  event_category: SecurityEventCategory;
  event_type: string;
  occurred_at: string;
  environment: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  outcome: "success" | "failed" | "denied";
  source_service: string;
  correlation_id?: string;
  metadata: Record<string, unknown>;
}

export interface SecurityEventStreamInput {
  source: SiemSource;
  category: SecurityEventCategory;
  eventType: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: "success" | "failed" | "denied";
  occurredAt?: string;
  eventId?: string;
  sourceService: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export class SecurityEventStreamingService {
  async stream(input: SecurityEventStreamInput): Promise<void> {
    const normalized: NormalizedSecurityEvent = {
      event_id: input.eventId ?? crypto.randomUUID(),
      event_category: input.category,
      event_type: input.eventType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      tenant_id: input.tenantId,
      actor_id: input.actorId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      outcome: input.outcome,
      source_service: input.sourceService,
      correlation_id: input.correlationId,
      metadata: input.metadata ?? {},
    };

    try {
      await siemExportForwarderService.forward({
        id: normalized.event_id,
        source: input.source,
        tenantId: normalized.tenant_id,
        timestamp: normalized.occurred_at,
        payload: normalized,
      });
    } catch (error) {
      logger.error("Failed to stream normalized security event", error instanceof Error ? error : undefined, {
        eventType: input.eventType,
        tenantId: input.tenantId,
      });
    }
  }
}

export const securityEventStreamingService = new SecurityEventStreamingService();

