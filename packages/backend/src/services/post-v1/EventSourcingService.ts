/**
 * Event Sourcing Service
 *
 * Handles event storage, retrieval, and projections for audit trails
 * and state reconstruction. Uses Kafka for event storage and PostgreSQL
 * for projections and queries.
 */

import { BaseEvent, Event } from "@shared/types/events";
import { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js"
import { createServerSupabaseClient } from "../../lib/supabase.js";

import { EventProducer, getEventProducer } from "./EventProducer.js"
import { isKafkaEnabled } from "./kafkaConfig.js"

export interface EventStoreRecord {
  id: string;
  event_id: string;
  correlation_id: string;
  event_type: string;
  event_version: string;
  source: string;
  payload: unknown;
  metadata?: unknown;
  timestamp: Date;
  created_at: Date;
}

export interface Projection {
  id: string;
  projection_type: string;
  projection_key: string;
  data: unknown;
  version: number;
  last_event_id: string;
  last_updated: Date;
  created_at: Date;
}

export class EventSourcingService {
  private supabase: SupabaseClient;
  private _eventProducer: EventProducer | null = null;

  private get eventProducer(): EventProducer {
    if (!this._eventProducer) {
      this._eventProducer = getEventProducer();
    }
    return this._eventProducer;
  }
  private projections: Map<string, Map<string, Projection>> = new Map();

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  /**
   * Store an event in the event store
   */
  async storeEvent(organizationId: string, event: BaseEvent): Promise<void> {
    try {
      const record = {
        organization_id: organizationId,
        event_id: event.eventId as string,
        correlation_id: event.correlationId as string,
        event_type: event.eventType as string,
        event_version: event.version as string,
        source: event.source as string,
        payload: (event as Record<string, unknown>).payload || {},
        metadata: event.metadata,
        timestamp: event.timestamp as Date,
      };

      const { error } = await this.supabase.from("event_store").insert(record);

      if (error) {
        logger.error("Failed to store event", error, {
          organizationId,
          eventId: event.eventId as string,
          eventType: event.eventType as string,
        });
        throw error;
      }

      logger.debug("Event stored successfully", {
        organizationId,
        eventId: event.eventId as string,
        eventType: event.eventType as string,
        correlationId: event.correlationId as string,
      });
    } catch (error) {
      logger.error("Event storage failed", error as Error, {
        organizationId,
        eventId: event.eventId as string,
        eventType: event.eventType as string,
      });
      throw error;
    }
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelationId(organizationId: string, correlationId: string): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("correlation_id", correlationId)
        .order("timestamp", { ascending: true });

      if (error) {
        logger.error("Failed to retrieve events by correlation ID", error, {
          organizationId,
          correlationId,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by correlation ID", error as Error, {
        organizationId,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Get events by event type
   */
  async getEventsByType(
    organizationId: string,
    eventType: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("event_type", eventType)
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error("Failed to retrieve events by type", error, {
          organizationId,
          eventType,
          limit,
          offset,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by type", error as Error, {
        organizationId,
        eventType,
        limit,
        offset,
      });
      throw error;
    }
  }

  /**
   * Get events within a time range
   */
  async getEventsByTimeRange(
    organizationId: string,
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("timestamp", startTime.toISOString())
        .lte("timestamp", endTime.toISOString())
        .order("timestamp", { ascending: true })
        .limit(limit);

      if (error) {
        logger.error("Failed to retrieve events by time range", error, {
          organizationId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          limit,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by time range", error as Error, {
        organizationId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        limit,
      });
      throw error;
    }
  }

  /**
   * Create or update a projection
   */
  async updateProjection(
    organizationId: string,
    projectionType: string,
    projectionKey: string,
    event: BaseEvent,
    updateFunction: (currentData: unknown, event: Event) => unknown
  ): Promise<void> {
    try {
      // Get existing projection
      let projection = await this.getProjection(organizationId, projectionType, projectionKey);

      if (!projection) {
        // Create new projection
        const initialData = updateFunction(null, event as Event);
        projection = {
          id: `${organizationId}-${projectionType}-${projectionKey}`,
          projection_type: projectionType,
          projection_key: projectionKey,
          data: initialData,
          version: 1,
          last_event_id: event.eventId as string,
          last_updated: new Date(),
          created_at: new Date(),
        };

        const { error } = await this.supabase.from("projections").insert({
          ...projection,
          organization_id: organizationId,
        });

        if (error) {
          logger.error("Failed to create projection", error, {
            organizationId,
            projectionType,
            projectionKey,
            eventId: event.eventId as string,
          });
          throw error;
        }
      } else {
        // Update existing projection with optimistic locking
        const updatedData = updateFunction(projection.data, event as Event);
        const previousVersion = projection.version;
        projection.data = updatedData;
        projection.version += 1;
        projection.last_event_id = event.eventId as string;
        projection.last_updated = new Date();

        // Use version-based optimistic locking to prevent race conditions
        const { data: updateResult, error } = await this.supabase
          .from("projections")
          .update({
            data: projection.data,
            version: projection.version,
            last_event_id: projection.last_event_id,
            last_updated: projection.last_updated,
          })
          .eq("organization_id", organizationId)
          .eq("id", projection.id)
          .eq("version", previousVersion) // Only update if version matches (optimistic lock)
          .select();

        // Check if update succeeded (row was modified)
        if (!error && (!updateResult || updateResult.length === 0)) {
          // Version mismatch — another process updated the projection
          logger.warn("Projection update conflict detected, retrying", {
            organizationId,
            projectionType,
            projectionKey,
            expectedVersion: previousVersion,
          });
          // Invalidate cache and retry
          this.projections.get(projectionType)?.delete(projectionKey);
          return this.updateProjection(organizationId, projectionType, projectionKey, event, updateFunction);
        }

        if (error) {
          logger.error("Failed to update projection", error, {
            organizationId,
            projectionType,
            projectionKey,
            eventId: event.eventId as string,
          });
          throw error;
        }
      }

      // Cache in memory
      if (!this.projections.has(projectionType)) {
        this.projections.set(projectionType, new Map());
      }
      this.projections.get(projectionType)!.set(projectionKey, projection);

      logger.debug("Projection updated", {
        organizationId,
        projectionType,
        projectionKey,
        version: projection.version,
        eventId: event.eventId as string,
      });
    } catch (error) {
      logger.error("Projection update failed", error as Error, {
        organizationId,
        projectionType,
        projectionKey,
        eventId: event.eventId as string,
      });
      throw error;
    }
  }

  /**
   * Get a projection
   */
  async getProjection(organizationId: string, projectionType: string, projectionKey: string): Promise<Projection | null> {
    try {
      // Check memory cache first
      const cached = this.projections.get(projectionType)?.get(projectionKey);
      if (cached) {
        return cached;
      }

      // Query database
      const { data, error } = await this.supabase
        .from("projections")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("projection_type", projectionType)
        .eq("projection_key", projectionKey)
        .single();

      if (error && error.code !== "PGRST116") {
        // Not found error
        logger.error("Failed to get projection", error, {
          organizationId,
          projectionType,
          projectionKey,
        });
        throw error;
      }

      if (data) {
        // Cache in memory
        if (!this.projections.has(projectionType)) {
          this.projections.set(projectionType, new Map());
        }
        this.projections.get(projectionType)!.set(projectionKey, data);
      }

      return data || null;
    } catch (error) {
      logger.error("Failed to get projection", error as Error, {
        organizationId,
        projectionType,
        projectionKey,
      });
      throw error;
    }
  }

  /**
   * Get all projections of a type
   */
  async getProjectionsByType(organizationId: string, projectionType: string, limit: number = 100): Promise<Projection[]> {
    try {
      const { data, error } = await this.supabase
        .from("projections")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("projection_type", projectionType)
        .order("last_updated", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("Failed to get projections by type", error, {
          organizationId,
          projectionType,
          limit,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get projections by type", error as Error, {
        organizationId,
        projectionType,
        limit,
      });
      throw error;
    }
  }

  /**
   * Rebuild a projection from events
   */
  async rebuildProjection(
    organizationId: string,
    projectionType: string,
    projectionKey: string,
    updateFunction: (currentData: unknown, event: Event) => unknown,
    eventFilter?: (event: Event) => boolean
  ): Promise<void> {
    try {
      // Get all relevant events — scoped to tenant
      const events = await this.getEventsByType(organizationId, `${projectionType}.*`);
      const filteredEvents = eventFilter ? events.filter((e) => eventFilter(e as unknown as Event)) : events;

      // Sort by timestamp
      filteredEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Rebuild projection
      let currentData: unknown = null;
      for (const eventRecord of filteredEvents) {
        const event = {
          ...eventRecord,
          timestamp: new Date(eventRecord.timestamp),
        } as unknown as Event;

        currentData = updateFunction(currentData, event);
      }

      // Update or create projection
      const projection: Projection & { organization_id: string } = {
        id: `${organizationId}-${projectionType}-${projectionKey}`,
        organization_id: organizationId,
        projection_type: projectionType,
        projection_key: projectionKey,
        data: currentData,
        version: filteredEvents.length,
        last_event_id: filteredEvents[filteredEvents.length - 1]?.event_id || "",
        last_updated: new Date(),
        created_at: new Date(),
      };

      const { error } = await this.supabase
        .from("projections")
        .upsert(projection, { onConflict: "id" });

      if (error) {
        logger.error("Failed to rebuild projection", error, {
          organizationId,
          projectionType,
          projectionKey,
        });
        throw error;
      }

      logger.info("Projection rebuilt successfully", {
        organizationId,
        projectionType,
        projectionKey,
        eventCount: filteredEvents.length,
        dataSize: JSON.stringify(currentData).length,
      });
    } catch (error) {
      logger.error("Projection rebuild failed", error as Error, {
        organizationId,
        projectionType,
        projectionKey,
      });
      throw error;
    }
  }

  /**
   * Create audit trail projection updater
   */
  createAuditProjectionUpdater() {
    return (currentData: unknown, event: Event) => {
      const data = currentData as {
        events: unknown[];
        summary: {
          totalEvents: number;
          eventTypes: Record<string, number>;
          sources: Record<string, number>;
          timeRange: { firstEvent: string; lastEvent: string };
        };
      } | null;

      const result = data ?? {
        events: [],
        summary: {
          totalEvents: 0,
          eventTypes: {},
          sources: {},
          timeRange: {
            firstEvent: event.timestamp.toISOString(),
            lastEvent: event.timestamp.toISOString(),
          },
        },
      };

      // Add event to trail
      result.events.push({
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        source: event.source,
        timestamp: event.timestamp.toISOString(),
        metadata: event.metadata,
      });

      // Update summary
      result.summary.totalEvents += 1;
      result.summary.eventTypes[event.eventType] =
        (result.summary.eventTypes[event.eventType] || 0) + 1;
      result.summary.sources[event.source] =
        (result.summary.sources[event.source] || 0) + 1;
      result.summary.timeRange.lastEvent = event.timestamp.toISOString();

      // Keep only last 1000 events in memory
      if (result.events.length > 1000) {
        result.events = result.events.slice(-1000);
      }

      return result;
    };
  }

  /**
   * Get audit trail for a correlation ID
   */
  async getAuditTrail(organizationId: string, correlationId: string): Promise<unknown> {
    return this.getProjection(organizationId, "audit-trail", correlationId);
  }

  /**
   * Get system-wide audit summary for an organization
   */
  async getAuditSummary(organizationId: string): Promise<unknown> {
    return this.getProjection(organizationId, "audit-summary", "system");
  }
}

/**
 * Singleton event sourcing service instance
 */
let eventSourcingService: EventSourcingService | null = null;

export function getEventSourcingService(): EventSourcingService {
  if (!eventSourcingService) {
    eventSourcingService = new EventSourcingService();
  }
  return eventSourcingService;
}

/**
 * Initialize event sourcing with audit trail projections
 */
export async function initializeEventSourcing(): Promise<EventSourcingService> {
  const service = getEventSourcingService();

  // Register audit trail projection updater
  const auditUpdater = service.createAuditProjectionUpdater();

  // Note: Projection updates would be handled by event consumers
  // that listen to all events and call updateProjection

  return service;
}
