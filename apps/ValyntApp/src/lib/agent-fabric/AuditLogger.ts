/**
 * Audit Logger
 *
 * Provides comprehensive audit logging for all agent operations with
 * structured logging, compliance features, and audit trail management.
 */

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../utils/logger";

// ============================================================================
// Audit Types
// ============================================================================

export type AuditLevel = "debug" | "info" | "warn" | "error" | "critical";
export type AuditCategory =
  | "agent_execution"
  | "data_access"
  | "security"
  | "performance"
  | "compliance"
  | "system";

export interface AuditEvent {
  id: string;
  timestamp: Date;
  level: AuditLevel;
  category: AuditCategory;
  action: string;
  actor: {
    type: "agent" | "user" | "system";
    id: string;
    name?: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  details: Record<string, unknown>;
  metadata?: {
    sessionId?: string;
    requestId?: string;
    tenantId?: string;
    userId?: string;
    agentId?: string;
    ipAddress?: string;
    userAgent?: string;
    traceId?: string;
    spanId?: string;
  };
  compliance?: {
    dataClassification?: "public" | "internal" | "confidential" | "restricted";
    retentionPeriod?: number; // in days
    legalHold?: boolean;
    gdprRelevant?: boolean;
    hipaaRelevant?: boolean;
    soxRelevant?: boolean;
  };
  severity: "low" | "medium" | "high" | "critical";
  impact?: {
    affectedUsers?: number;
    affectedSystems?: string[];
    estimatedCost?: number;
    downtimeMinutes?: number;
  };
  remediation?: {
    action?: string;
    owner?: string;
    dueDate?: Date;
    status?: "open" | "in_progress" | "resolved" | "closed";
  };
}

export interface AuditQuery {
  level?: AuditLevel;
  category?: AuditCategory;
  actorType?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  sessionId?: string;
  tenantId?: string;
  userId?: string;
  agentId?: string;
  severity?: string;
  limit?: number;
  offset?: number;
  searchText?: string;
}

export interface AuditSearchResult {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
  queryTime: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByLevel: Record<AuditLevel, number>;
  eventsByCategory: Record<AuditCategory, number>;
  criticalEvents: number;
  complianceEvents: number;
  averageEventsPerDay: number;
  oldestEvent?: Date;
  newestEvent?: Date;
  topActors: Array<{
    id: string;
    type: string;
    eventCount: number;
  }>;
  topResources: Array<{
    type: string;
    id: string;
    eventCount: number;
  }>;
}

// ============================================================================
// Audit Storage Interface
// ============================================================================

export interface IAuditStorage {
  store(event: AuditEvent): Promise<void>;
  search(query: AuditQuery): Promise<AuditSearchResult>;
  getStats(query?: Partial<AuditQuery>): Promise<AuditStats>;
  archive(beforeDate: Date): Promise<number>; // Returns number of archived events
  purge(beforeDate: Date, exceptions?: string[]): Promise<number>; // Returns number of purged events
}

// ============================================================================
// In-Memory Audit Storage Implementation
// ============================================================================

class InMemoryAuditStorage implements IAuditStorage {
  private events: AuditEvent[] = [];
  private maxEvents: number = 10000;

  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);

    // Maintain size limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    logger.debug("Audit event stored", {
      eventId: event.id,
      level: event.level,
      category: event.category,
      action: event.action,
    });
  }

  async search(query: AuditQuery): Promise<AuditSearchResult> {
    const startTime = Date.now();
    let filteredEvents = [...this.events];

    // Apply filters
    if (query.level) {
      filteredEvents = filteredEvents.filter((event) => event.level === query.level);
    }
    if (query.category) {
      filteredEvents = filteredEvents.filter((event) => event.category === query.category);
    }
    if (query.actorType) {
      filteredEvents = filteredEvents.filter((event) => event.actor.type === query.actorType);
    }
    if (query.actorId) {
      filteredEvents = filteredEvents.filter((event) => event.actor.id === query.actorId);
    }
    if (query.resourceType) {
      filteredEvents = filteredEvents.filter((event) => event.resource.type === query.resourceType);
    }
    if (query.resourceId) {
      filteredEvents = filteredEvents.filter((event) => event.resource.id === query.resourceId);
    }
    if (query.severity) {
      filteredEvents = filteredEvents.filter((event) => event.severity === query.severity);
    }
    if (query.sessionId) {
      filteredEvents = filteredEvents.filter(
        (event) => event.metadata?.sessionId === query.sessionId
      );
    }
    if (query.tenantId) {
      filteredEvents = filteredEvents.filter(
        (event) => event.metadata?.tenantId === query.tenantId
      );
    }
    if (query.userId) {
      filteredEvents = filteredEvents.filter((event) => event.metadata?.userId === query.userId);
    }
    if (query.agentId) {
      filteredEvents = filteredEvents.filter((event) => event.metadata?.agentId === query.agentId);
    }

    // Time range filter
    if (query.timeRange) {
      filteredEvents = filteredEvents.filter(
        (event) =>
          event.timestamp >= query.timeRange?.start && event.timestamp <= query.timeRange?.end
      );
    }

    // Text search
    if (query.searchText) {
      const searchText = query.searchText.toLowerCase();
      filteredEvents = filteredEvents.filter(
        (event) =>
          event.action.toLowerCase().includes(searchText) ||
          JSON.stringify(event.details).toLowerCase().includes(searchText) ||
          event.resource.name?.toLowerCase().includes(searchText) ||
          event.actor.name?.toLowerCase().includes(searchText)
      );
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total: filteredEvents.length,
      hasMore: offset + limit < filteredEvents.length,
      queryTime: Date.now() - startTime,
    };
  }

  async getStats(query?: Partial<AuditQuery>): Promise<AuditStats> {
    let events = [...this.events];

    // Apply same filters as search
    if (query) {
      if (query.level) {
        events = events.filter((event) => event.level === query.level);
      }
      if (query.category) {
        events = events.filter((event) => event.category === query.category);
      }
      if (query.timeRange) {
        events = events.filter(
          (event) =>
            event.timestamp >= query.timeRange?.start && event.timestamp <= query.timeRange?.end
        );
      }
    }

    const eventsByLevel: Record<AuditLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const eventsByCategory: Record<AuditCategory, number> = {
      agent_execution: 0,
      data_access: 0,
      security: 0,
      performance: 0,
      compliance: 0,
      system: 0,
    };

    let criticalEvents = 0;
    let complianceEvents = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    const actorCounts = new Map<string, { type: string; count: number }>();
    const resourceCounts = new Map<string, { type: string; id: string; count: number }>();

    for (const event of events) {
      eventsByLevel[event.level]++;
      eventsByCategory[event.category]++;

      if (event.severity === "critical") criticalEvents++;
      if (event.compliance) complianceEvents++;

      if (!oldestDate || event.timestamp < oldestDate) oldestDate = event.timestamp;
      if (!newestDate || event.timestamp > newestDate) newestDate = event.timestamp;

      // Count actors
      const actorKey = `${event.actor.type}:${event.actor.id}`;
      const actorCount = actorCounts.get(actorKey);
      if (actorCount) {
        actorCount.count++;
      } else {
        actorCounts.set(actorKey, { type: event.actor.type, count: 1 });
      }

      // Count resources
      if (event.resource.id) {
        const resourceKey = `${event.resource.type}:${event.resource.id}`;
        const resourceCount = resourceCounts.get(resourceKey);
        if (resourceCount) {
          resourceCount.count++;
        } else {
          resourceCounts.set(resourceKey, {
            type: event.resource.type,
            id: event.resource.id,
            count: 1,
          });
        }
      }
    }

    const topActors = Array.from(actorCounts.entries())
      .map(([key, data]) => ({
        id: key.split(":")[1],
        type: data.type,
        eventCount: data.count,
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    const topResources = Array.from(resourceCounts.entries())
      .map(([key, data]) => data)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average events per day
    const daysSpan =
      oldestDate && newestDate
        ? Math.max(
            1,
            Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : 1;
    const averageEventsPerDay = events.length / daysSpan;

    return {
      totalEvents: events.length,
      eventsByLevel,
      eventsByCategory,
      criticalEvents,
      complianceEvents,
      averageEventsPerDay,
      oldestEvent: oldestDate,
      newestEvent: newestDate,
      topActors,
      topResources,
    };
  }

  async archive(beforeDate: Date): Promise<number> {
    // In a real implementation, this would move events to archival storage
    // For now, just remove them from memory
    const initialCount = this.events.length;
    this.events = this.events.filter((event) => event.timestamp >= beforeDate);
    const archivedCount = initialCount - this.events.length;

    logger.info("Audit events archived", { archivedCount, beforeDate });
    return archivedCount;
  }

  async purge(beforeDate: Date, exceptions?: string[]): Promise<number> {
    // In a real implementation, this would permanently delete events
    // For now, just remove them from memory (except exceptions)
    const initialCount = this.events.length;
    this.events = this.events.filter((event) => {
      if (event.timestamp < beforeDate) {
        if (exceptions && exceptions.includes(event.id)) {
          return true; // Keep exception events
        }
        return false; // Remove
      }
      return true; // Keep recent events
    });
    const purgedCount = initialCount - this.events.length;

    logger.info("Audit events purged", { purgedCount, beforeDate, exceptions });
    return purgedCount;
  }
}

// ============================================================================
// Audit Logger Implementation
// ============================================================================

export class AuditLogger {
  private storage: IAuditStorage;
  private defaultMetadata: Partial<AuditEvent["metadata"]> = {};

  constructor(storage?: IAuditStorage, defaultMetadata?: Partial<AuditEvent["metadata"]>) {
    this.storage = storage || new InMemoryAuditStorage();
    this.defaultMetadata = defaultMetadata || {};

    logger.info("Audit Logger initialized", {
      storageType: this.storage.constructor.name,
    });
  }

  async logAgentExecution(
    action: string,
    agentId: string,
    agentName: string,
    details: Record<string, unknown>,
    level: AuditLevel = "info",
    severity: AuditEvent["severity"] = "low",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "agent_execution",
      action,
      actor: {
        type: "agent",
        id: agentId,
        name: agentName,
      },
      resource: {
        type: "agent_execution",
        id: agentId,
        name: agentName,
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        agentId,
        ...metadata,
      },
      severity,
    };

    await this.storage.store(event);

    // Also log to standard logger for immediate visibility
    if (level === "error" || level === "critical") {
      logger.error(`Agent Execution: ${action}`, {
        agentId,
        agentName,
        details,
        eventId: event.id,
      });
    } else if (level === "warn") {
      logger.warn(`Agent Execution: ${action}`, {
        agentId,
        agentName,
        details,
        eventId: event.id,
      });
    } else {
      logger.info(`Agent Execution: ${action}`, {
        agentId,
        agentName,
        details,
        eventId: event.id,
      });
    }

    return event.id;
  }

  async logDataAccess(
    action: string,
    resourceType: string,
    resourceId: string,
    resourceName: string,
    details: Record<string, unknown>,
    level: AuditLevel = "info",
    severity: AuditEvent["severity"] = "medium",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "data_access",
      action,
      actor: {
        type: "agent", // Default to agent, can be overridden
        id: metadata?.agentId || "system",
      },
      resource: {
        type: resourceType,
        id: resourceId,
        name: resourceName || undefined,
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
      severity,
    };

    await this.storage.store(event);

    logger.info(`Data Access: ${action}`, {
      resourceType,
      resourceId,
      resourceName,
      details,
      eventId: event.id,
    });

    return event.id;
  }

  async logSecurity(
    action: string,
    details: Record<string, unknown>,
    severity: AuditEvent["severity"] = "high",
    level: AuditLevel = "warn",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "security",
      action,
      actor: {
        type: "system",
        id: "audit-system",
      },
      resource: {
        type: "security_event",
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
      severity,
    };

    await this.storage.store(event);

    logger.warn(`Security Event: ${action}`, {
      details,
      severity,
      eventId: event.id,
    });

    return event.id;
  }

  async logPerformance(
    action: string,
    details: Record<string, unknown>,
    level: AuditLevel = "info",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "performance",
      action,
      actor: {
        type: "system",
        id: "performance-monitor",
      },
      resource: {
        type: "performance_metric",
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
      severity: "low",
    };

    await this.storage.store(event);

    logger.debug(`Performance: ${action}`, {
      details,
      eventId: event.id,
    });

    return event.id;
  }

  async logCompliance(
    action: string,
    details: Record<string, unknown>,
    compliance: AuditEvent["compliance"],
    level: AuditLevel = "info",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "compliance",
      action,
      actor: {
        type: "system",
        id: "compliance-monitor",
      },
      resource: {
        type: "compliance_event",
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
      compliance,
      severity: "medium",
    };

    await this.storage.store(event);

    logger.info(`Compliance: ${action}`, {
      details,
      compliance,
      eventId: event.id,
    });

    return event.id;
  }

  async logSystem(
    action: string,
    details: Record<string, unknown>,
    level: AuditLevel = "info",
    severity: AuditEvent["severity"] = "low",
    metadata?: Partial<AuditEvent["metadata"]>
  ): Promise<string> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category: "system",
      action,
      actor: {
        type: "system",
        id: "system",
      },
      resource: {
        type: "system_event",
      },
      details,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
      severity,
    };

    await this.storage.store(event);

    logger.debug(`System: ${action}`, {
      details,
      eventId: event.id,
    });

    return event.id;
  }

  // Query methods
  async search(query: AuditQuery): Promise<AuditSearchResult> {
    return await this.storage.search(query);
  }

  async getStats(query?: Partial<AuditQuery>): Promise<AuditStats> {
    return await this.storage.getStats(query);
  }

  // Utility methods
  async getAgentHistory(agentId: string, limit: number = 100): Promise<AuditSearchResult> {
    return await this.search({
      actorId: agentId,
      limit,
    });
  }

  async getSessionHistory(sessionId: string, limit: number = 200): Promise<AuditSearchResult> {
    return await this.search({
      sessionId,
      limit,
    });
  }

  async getSecurityEvents(severity?: string, limit: number = 50): Promise<AuditSearchResult> {
    return await this.search({
      category: "security",
      severity,
      limit,
    });
  }

  async getComplianceEvents(limit: number = 100): Promise<AuditSearchResult> {
    return await this.search({
      category: "compliance",
      limit,
    });
  }

  // Maintenance methods
  async archiveEvents(olderThanDays: number = 90): Promise<number> {
    const beforeDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return await this.storage.archive(beforeDate);
  }

  async purgeEvents(olderThanDays: number = 365, exceptions?: string[]): Promise<number> {
    const beforeDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return await this.storage.purge(beforeDate, exceptions);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAuditLogger(
  storage?: IAuditStorage,
  defaultMetadata?: Partial<AuditEvent["metadata"]>
): AuditLogger {
  return new AuditLogger(storage, defaultMetadata);
}
