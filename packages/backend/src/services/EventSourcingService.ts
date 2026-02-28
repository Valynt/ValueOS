/**
 * Event Sourcing Service
 *
 * Handles event storage, retrieval, and projections for audit trails
 * and state reconstruction. Uses Kafka for event storage and PostgreSQL
 * for projections and queries.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../lib/supabase.js";
import { logger } from "../lib/logger.js"
import { BaseEvent, Event } from "@shared/types/events";
import { EventProducer, getEventProducer } from "./EventProducer.js"
import { isKafkaEnabled } from "./kafkaConfig.js"

export interface EventStoreRecord {
  id: string;
  event_id: string;
  correlation_id: string;
  event_type: string;
  event_version: string;
  source: string;
  payload: any;
  metadata?: any;
  timestamp: Date;
  created_at: Date;
}

export interface Projection {
  id: string;
  projection_type: string;
  projection_key: string;
  data: any;
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
  async storeEvent(event: BaseEvent): Promise<void> {
    try {
      const record: Omit<EventStoreRecord, "id" | "created_at"> = {
        event_id: event.eventId,
        correlation_id: event.correlationId,
        event_type: event.eventType,
        event_version: event.version,
        source: event.source,
        payload: (event as any).payload || {},
        metadata: event.metadata,
        timestamp: event.timestamp,
      };

      const { error } = await this.supabase.from("event_store").insert(record);

      if (error) {
        logger.error("Failed to store event", error, {
          eventId: event.eventId,
          eventType: event.eventType,
        });
        throw error;
      }

      logger.debug("Event stored successfully", {
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
      });
    } catch (error) {
      logger.error("Event storage failed", error as Error, {
        eventId: event.eventId,
        eventType: event.eventType,
      });
      throw error;
    }
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelationId(correlationId: string): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .eq("correlation_id", correlationId)
        .order("timestamp", { ascending: true });

      if (error) {
        logger.error("Failed to retrieve events by correlation ID", error, {
          correlationId,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by correlation ID", error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Get events by event type
   */
  async getEventsByType(
    eventType: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .eq("event_type", eventType)
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error("Failed to retrieve events by type", error, {
          eventType,
          limit,
          offset,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by type", error as Error, {
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
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ): Promise<EventStoreRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from("event_store")
        .select("*")
        .gte("timestamp", startTime.toISOString())
        .lte("timestamp", endTime.toISOString())
        .order("timestamp", { ascending: true })
        .limit(limit);

      if (error) {
        logger.error("Failed to retrieve events by time range", error, {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          limit,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get events by time range", error as Error, {
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
    projectionType: string,
    projectionKey: string,
    event: BaseEvent,
    updateFunction: (currentData: any, event: Event) => any
  ): Promise<void> {
    try {
      // Get existing projection
      let projection = await this.getProjection(projectionType, projectionKey);

      if (!projection) {
        // Create new projection
        const initialData = updateFunction(null, event as Event);
        projection = {
          id: `${projectionType}-${projectionKey}`,
          projection_type: projectionType,
          projection_key: projectionKey,
          data: initialData,
          version: 1,
          last_event_id: event.eventId,
          last_updated: new Date(),
          created_at: new Date(),
        };

        const { error } = await this.supabase.from("projections").insert(projection);

        if (error) {
          logger.error("Failed to create projection", error, {
            projectionType,
            projectionKey,
            eventId: event.eventId,
          });
          throw error;
        }
      } else {
        // Update existing projection with optimistic locking
        const updatedData = updateFunction(projection.data, event as Event);
        const previousVersion = projection.version;
        projection.data = updatedData;
        projection.version += 1;
        projection.last_event_id = event.eventId;
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
          .eq("id", projection.id)
          .eq("version", previousVersion) // Only update if version matches (optimistic lock)
          .select();

        // Check if update succeeded (row was modified)
        if (!error && (!updateResult || updateResult.length === 0)) {
          // Version mismatch - another process updated the projection
          logger.warn("Projection update conflict detected, retrying", {
            projectionType,
            projectionKey,
            expectedVersion: previousVersion,
          });
          // Invalidate cache and retry
          this.projections.get(projectionType)?.delete(projectionKey);
          return this.updateProjection(projectionType, projectionKey, event, updateFunction);
        }

        if (error) {
          logger.error("Failed to update projection", error, {
            projectionType,
            projectionKey,
            eventId: event.eventId,
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
        projectionType,
        projectionKey,
        version: projection.version,
        eventId: event.eventId,
      });
    } catch (error) {
      logger.error("Projection update failed", error as Error, {
        projectionType,
        projectionKey,
        eventId: event.eventId,
      });
      throw error;
    }
  }

  /**
   * Get a projection
   */
  async getProjection(projectionType: string, projectionKey: string): Promise<Projection | null> {
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
        .eq("projection_type", projectionType)
        .eq("projection_key", projectionKey)
        .single();

      if (error && error.code !== "PGRST116") {
        // Not found error
        logger.error("Failed to get projection", error, {
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
        projectionType,
        projectionKey,
      });
      throw error;
    }
  }

  /**
   * Get all projections of a type
   */
  async getProjectionsByType(projectionType: string, limit: number = 100): Promise<Projection[]> {
    try {
      const { data, error } = await this.supabase
        .from("projections")
        .select("*")
        .eq("projection_type", projectionType)
        .order("last_updated", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("Failed to get projections by type", error, {
          projectionType,
          limit,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to get projections by type", error as Error, {
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
    projectionType: string,
    projectionKey: string,
    updateFunction: (currentData: any, event: Event) => any,
    eventFilter?: (event: Event) => boolean
  ): Promise<void> {
    try {
      // Get all relevant events
      const events = await this.getEventsByType(`${projectionType}.*`);
      const filteredEvents = eventFilter ? events.filter((e) => eventFilter(e as any)) : events;

      // Sort by timestamp
      filteredEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Rebuild projection
      let currentData: any = null;
      for (const eventRecord of filteredEvents) {
        const event = {
          ...eventRecord,
          timestamp: new Date(eventRecord.timestamp),
        } as Event;

        currentData = updateFunction(currentData, event);
      }

      // Update or create projection
      const projection: Projection = {
        id: `${projectionType}-${projectionKey}`,
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
          projectionType,
          projectionKey,
        });
        throw error;
      }

      logger.info("Projection rebuilt successfully", {
        projectionType,
        projectionKey,
        eventCount: filteredEvents.length,
        dataSize: JSON.stringify(currentData).length,
      });
    } catch (error) {
      logger.error("Projection rebuild failed", error as Error, {
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
    return (currentData: any, event: Event) => {
      if (!currentData) {
        currentData = {
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
      }

      // Add event to trail
      currentData.events.push({
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        source: event.source,
        timestamp: event.timestamp.toISOString(),
        metadata: event.metadata,
      });

      // Update summary
      currentData.summary.totalEvents += 1;
      currentData.summary.eventTypes[event.eventType] =
        (currentData.summary.eventTypes[event.eventType] || 0) + 1;
      currentData.summary.sources[event.source] =
        (currentData.summary.sources[event.source] || 0) + 1;
      currentData.summary.timeRange.lastEvent = event.timestamp.toISOString();

      // Keep only last 1000 events in memory
      if (currentData.events.length > 1000) {
        currentData.events = currentData.events.slice(-1000);
      }

      return currentData;
    };
  }

  /**
   * Get audit trail for a correlation ID
   */
  async getAuditTrail(correlationId: string): Promise<any> {
    return this.getProjection("audit-trail", correlationId);
  }

  /**
   * Get system-wide audit summary
   */
  async getAuditSummary(): Promise<any> {
    return this.getProjection("audit-summary", "system");
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
