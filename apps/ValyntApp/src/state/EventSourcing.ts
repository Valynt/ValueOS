/**
 * Event Sourcing for Race Conditions
 *
 * Implements event sourcing pattern to prevent race conditions and ensure
 * state consistency across concurrent operations in ValueOS.
 *
 * Responsibilities:
 * - Event store for state changes
 * - Optimistic locking with version numbers
 * - Event replay for state reconstruction
 * - Conflict resolution for concurrent updates
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface StateEvent {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: string;
  eventData: Record<string, unknown>;
  version: number;
  timestamp: Date;
  causationId?: string;
  correlationId?: string;
  metadata: EventMetadata;
}

export enum AggregateType {
  WORKFLOW_STATE = 'workflow_state',
  CANVAS_STATE = 'canvas_state',
  AGENT_MEMORY = 'agent_memory',
  SDUI_RENDER = 'sdui_render',
}

export interface EventMetadata {
  userId?: string;
  tenantId: string;
  agentType?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  complianceTags: string[];
}

export interface OptimisticLockResult {
  success: boolean;
  event?: StateEvent;
  conflict?: ConflictError;
  currentVersion?: number;
}

export interface ConflictError {
  type: ConflictType;
  expectedVersion: number;
  actualVersion: number;
  conflictingEvents: StateEvent[];
  resolution?: ConflictResolution;
}

export enum ConflictType {
  VERSION_CONFLICT = 'version_conflict',
  SIMULTANEOUS_UPDATE = 'simultaneous_update',
  STATE_CORRUPTION = 'state_corruption',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
}

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedEvents: StateEvent[];
  mergedState?: Record<string, unknown>;
}

export enum ResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  MERGE = 'merge',
  MANUAL_REVIEW = 'manual_review',
  REJECT = 'reject',
}

export interface EventStore {
  append(event: StateEvent): Promise<void>;
  getEvents(aggregateId: string, tenantId: string, fromVersion?: number): Promise<StateEvent[]>;
  getEvent(eventId: string, tenantId: string): Promise<StateEvent | null>;
  getVersion(aggregateId: string, tenantId: string): Promise<number>;
}

// ============================================================================
// Event Sourcing Manager
// ============================================================================

export class EventSourcingManager {
  private eventStore: EventStore;
  private conflictResolvers: Map<AggregateType, ConflictResolver>;
  private eventHandlers: Map<string, EventHandler>;
  private snapshots = new Map<string, StateSnapshot>();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.eventStore = new SupabaseEventStore(supabaseUrl, supabaseKey);
    this.conflictResolvers = new Map();
    this.eventHandlers = new Map();
    this.initializeResolvers();
    this.initializeHandlers();
  }

  /**
   * Append event with optimistic locking
   */
  async appendEvent(
    aggregateId: string,
    aggregateType: AggregateType,
    eventType: string,
    eventData: Record<string, unknown>,
    expectedVersion: number,
    metadata: EventMetadata
  ): Promise<OptimisticLockResult> {
    try {
      // Check current version
      const currentVersion = await this.eventStore.getVersion(aggregateId, metadata.tenantId);

      if (currentVersion !== expectedVersion) {
        // Version conflict detected
        const conflict = await this.handleVersionConflict(
          aggregateId,
          aggregateType,
          expectedVersion,
          currentVersion,
          metadata.tenantId
        );

        return {
          success: false,
          conflict,
          currentVersion,
        };
      }

      // Create event
      const event: StateEvent = {
        id: uuidv4(),
        aggregateId,
        aggregateType,
        eventType,
        eventData,
        version: currentVersion + 1,
        timestamp: new Date(),
        metadata,
      };

      // Validate event
      await this.validateEvent(event);

      // Append to store
      await this.eventStore.append(event);

      // Apply event to state
      await this.applyEvent(event);

      // Update snapshot if needed
      await this.updateSnapshot(aggregateId, aggregateType, metadata.tenantId);

      logger.info('Event appended successfully', {
        eventId: event.id,
        aggregateId,
        aggregateType,
        eventType,
        version: event.version,
      });

      return {
        success: true,
        event,
      };

    } catch (error) {
      logger.error('Failed to append event', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Replay events to reconstruct state
   */
  async replayEvents(
    aggregateId: string,
    aggregateType: AggregateType,
    tenantId: string,
    fromVersion?: number
  ): Promise<Record<string, unknown>> {
    try {
      // Check for recent snapshot
      const snapshot = await this.getSnapshot(aggregateId, fromVersion);

      let currentState = snapshot?.state || this.getInitialState(aggregateType);
      let startVersion: number;

      if (snapshot) {
        // Start from the first event AFTER the snapshot version to avoid double-applying
        startVersion = snapshot.version + 1;

        // If caller requested a later starting version, honor that
        if (fromVersion !== undefined && fromVersion > startVersion) {
          startVersion = fromVersion;
        }
      } else {
        // No snapshot: start from requested version or from the beginning
        startVersion = fromVersion ?? 0;
      }

      // Get events from computed start version
      const events = await this.eventStore.getEvents(aggregateId, tenantId, startVersion);

      // Apply events in order
      for (const event of events) {
        currentState = await this.applyEventToState(currentState, event);
      }

      logger.info('Events replayed successfully', {
        aggregateId,
        aggregateType,
        eventCount: events.length,
        finalVersion: startVersion + events.length,
      });

      return currentState;

    } catch (error) {
      logger.error('Failed to replay events', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Handle concurrent updates
   */
  async handleConcurrentUpdate(
    aggregateId: string,
    aggregateType: AggregateType,
    updates: Record<string, unknown>,
    metadata: EventMetadata
  ): Promise<OptimisticLockResult> {
    try {
      // Get current state
      const currentState = await this.replayEvents(aggregateId, aggregateType, metadata.tenantId);
      const currentVersion = await this.eventStore.getVersion(aggregateId, metadata.tenantId);

      // Check for business rule violations
      const validationResult = await this.validateBusinessRules(
        aggregateType,
        currentState,
        updates
      );

      if (!validationResult.valid) {
        return {
          success: false,
          conflict: {
            type: ConflictType.BUSINESS_RULE_VIOLATION,
            expectedVersion: currentVersion,
            actualVersion: currentVersion,
            conflictingEvents: [],
            resolution: {
              strategy: ResolutionStrategy.REJECT,
              resolvedEvents: [],
            },
          },
          currentVersion,
        };
      }

      // Append update event
      return await this.appendEvent(
        aggregateId,
        aggregateType,
        'state_updated',
        updates,
        currentVersion,
        metadata
      );

    } catch (error) {
      logger.error('Failed to handle concurrent update', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Get current state
   */
  async getCurrentState(
    aggregateId: string,
    aggregateType: AggregateType,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    return await this.replayEvents(aggregateId, aggregateType, tenantId);
  }

  /**
   * Get event history
   */
  async getEventHistory(
    aggregateId: string,
    tenantId: string,
    limit?: number,
    offset?: number
  ): Promise<StateEvent[]> {
    const events = await this.eventStore.getEvents(aggregateId, tenantId);

    let sortedEvents = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (offset) {
      sortedEvents = sortedEvents.slice(offset);
    }

    if (limit) {
      sortedEvents = sortedEvents.slice(0, limit);
    }

    return sortedEvents;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async handleVersionConflict(
    aggregateId: string,
    aggregateType: AggregateType,
    expectedVersion: number,
    actualVersion: number,
    tenantId: string
  ): Promise<ConflictError> {
    try {
      // Get conflicting events
      const conflictingEvents = await this.eventStore.getEvents(
        aggregateId,
        tenantId,
        expectedVersion
      );

      // Get resolver for aggregate type
      const resolver = this.conflictResolvers.get(aggregateType);

      if (!resolver) {
        return {
          type: ConflictType.VERSION_CONFLICT,
          expectedVersion,
          actualVersion,
          conflictingEvents,
        };
      }

      // Attempt resolution
      const resolution = await resolver.resolve(
        aggregateId,
        expectedVersion,
        actualVersion,
        conflictingEvents
      );

      return {
        type: ConflictType.VERSION_CONFLICT,
        expectedVersion,
        actualVersion,
        conflictingEvents,
        resolution,
      };

    } catch (error) {
      logger.error('Failed to handle version conflict', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  private async validateEvent(event: StateEvent): Promise<void> {
    // Basic validation
    if (!event.aggregateId) {
      throw new Error('Aggregate ID is required');
    }
    if (!event.eventType) {
      throw new Error('Event type is required');
    }
    if (event.version < 1) {
      throw new Error('Version must be >= 1');
    }

    // Event type validation
    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      await handler.validate(event);
    }
  }

  private async applyEvent(event: StateEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      await handler.apply(event);
    }
  }

  private async applyEventToState(
    currentState: Record<string, unknown>,
    event: StateEvent
  ): Promise<Record<string, unknown>> {
    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      return await handler.applyToState(currentState, event);
    }

    return currentState;
  }

  private async validateBusinessRules(
    aggregateType: AggregateType,
    currentState: Record<string, unknown>,
    updates: Record<string, unknown>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Workflow state rules
    if (aggregateType === AggregateType.WORKFLOW_STATE) {
      if (updates.currentStage && currentState.completedStages) {
        const prerequisites = this.getStagePrerequisites(updates.currentStage);
        for (const prerequisite of prerequisites) {
          if (!currentState.completedStages.includes(prerequisite)) {
            errors.push(`Cannot transition to ${updates.currentStage} without completing ${prerequisite}`);
          }
        }
      }
    }

    // Canvas state rules
    if (aggregateType === AggregateType.CANVAS_STATE) {
      if (updates.components && currentState.currentStage) {
        const stageConfig = this.getStageConfig(currentState.currentStage);
        for (const component of updates.components) {
          if (!stageConfig.allowedComponents.includes(component.type)) {
            errors.push(`Component ${component.type} not allowed in stage ${currentState.currentStage}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private getInitialState(aggregateType: AggregateType): Record<string, unknown> {
    const initialStates = {
      [AggregateType.WORKFLOW_STATE]: {
        currentStage: 'opportunity',
        status: 'in_progress',
        completedStages: [],
        context: {},
        metadata: {
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        },
      },
      [AggregateType.CANVAS_STATE]: {
        components: [],
        layout: null,
        version: 1,
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
      [AggregateType.AGENT_MEMORY]: {
        memories: [],
        context: {},
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
      [AggregateType.SDUI_RENDER]: {
        pages: [],
        currentVersion: 1,
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    };

    return initialStates[aggregateType] || {};
  }

  private async getSnapshot(
    aggregateId: string,
    fromVersion?: number
  ): Promise<StateSnapshot | null> {
    const snapshotKey = `${aggregateId}_snapshot`;
    return this.snapshots.get(snapshotKey) || null;
  }

  private async updateSnapshot(
    aggregateId: string,
    aggregateType: AggregateType,
    tenantId: string
  ): Promise<void> {
    // Create snapshot every 10 events
    const version = await this.eventStore.getVersion(aggregateId, tenantId);

    if (version % 10 === 0) {
      const currentState = await this.replayEvents(aggregateId, aggregateType, tenantId);

      const snapshot: StateSnapshot = {
        aggregateId,
        aggregateType,
        version,
        state: currentState,
        timestamp: new Date(),
      };

      this.snapshots.set(`${aggregateId}_snapshot`, snapshot);

      logger.debug('Snapshot created', {
        aggregateId,
        version,
      });
    }
  }

  private getStagePrerequisites(stage: string): string[] {
    const prerequisites: Record<string, string[]> = {
      opportunity: [],
      target: ['opportunity'],
      realization: ['target'],
      expansion: ['realization'],
    };

    return prerequisites[stage] || [];
  }

  private getStageConfig(stage: string) {
    const configs: Record<string, { allowedComponents: string[] }> = {
      opportunity: {
        allowedComponents: ['ValueHypothesisCard', 'MetricBadge', 'TextBlock'],
      },
      target: {
        allowedComponents: ['MetricBadge', 'TextBlock', 'DataTable', 'Chart'],
      },
      realization: {
        allowedComponents: ['DataTable', 'Chart', 'TextBlock', 'ProgressTracker'],
      },
      expansion: {
        allowedComponents: ['TextBlock', 'Chart', 'RecommendationCard'],
      },
    };

    return configs[stage] || { allowedComponents: [] };
  }

  private initializeResolvers(): void {
    // Workflow state resolver
    this.conflictResolvers.set(AggregateType.WORKFLOW_STATE, new WorkflowStateConflictResolver());

    // Canvas state resolver
    this.conflictResolvers.set(AggregateType.CANVAS_STATE, new CanvasStateConflictResolver());

    // Default resolver
    this.conflictResolvers.set(AggregateType.AGENT_MEMORY, new DefaultConflictResolver());
    this.conflictResolvers.set(AggregateType.SDUI_RENDER, new DefaultConflictResolver());
  }

  private initializeHandlers(): void {
    // Workflow state handlers
    this.eventHandlers.set('stage_transition', new WorkflowStateEventHandler());
    this.eventHandlers.set('context_updated', new WorkflowStateEventHandler());
    this.eventHandlers.set('state_updated', new WorkflowStateEventHandler());

    // Canvas state handlers
    this.eventHandlers.set('component_added', new CanvasStateEventHandler());
    this.eventHandlers.set('component_removed', new CanvasStateEventHandler());
    this.eventHandlers.set('component_updated', new CanvasStateEventHandler());
  }
}

// ============================================================================
// Supporting Classes
// ============================================================================

interface StateSnapshot {
  aggregateId: string;
  aggregateType: AggregateType;
  version: number;
  state: Record<string, unknown>;
  timestamp: Date;
}

interface ConflictResolver {
  resolve(
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
    conflictingEvents: StateEvent[]
  ): Promise<ConflictResolution>;
}

interface EventHandler {
  validate(event: StateEvent): Promise<void>;
  apply(event: StateEvent): Promise<void>;
  applyToState(state: Record<string, unknown>, event: StateEvent): Promise<Record<string, unknown>>;
}

class WorkflowStateConflictResolver implements ConflictResolver {
  async resolve(
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
    conflictingEvents: StateEvent[]
  ): Promise<ConflictResolution> {
    // For workflow state, use merge strategy
    return {
      strategy: ResolutionStrategy.MERGE,
      resolvedEvents: conflictingEvents,
    };
  }
}

class CanvasStateConflictResolver implements ConflictResolver {
  async resolve(
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
    conflictingEvents: StateEvent[]
  ): Promise<ConflictResolution> {
    // For canvas state, last write wins
    return {
      strategy: ResolutionStrategy.LAST_WRITE_WINS,
      resolvedEvents: [conflictingEvents[conflictingEvents.length - 1]],
    };
  }
}

class DefaultConflictResolver implements ConflictResolver {
  async resolve(
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
    conflictingEvents: StateEvent[]
  ): Promise<ConflictResolution> {
    // Default: manual review
    return {
      strategy: ResolutionStrategy.MANUAL_REVIEW,
      resolvedEvents: [],
    };
  }
}

class WorkflowStateEventHandler implements EventHandler {
  async validate(event: StateEvent): Promise<void> {
    // Validate workflow state events
    if (event.eventType === 'stage_transition') {
      const newStage = event.eventData.newStage;
      const validStages = ['opportunity', 'target', 'realization', 'expansion'];

      if (!validStages.includes(newStage)) {
        throw new Error(`Invalid stage transition: ${newStage}`);
      }
    }
  }

  async apply(event: StateEvent): Promise<void> {
    // Apply event to event store (already done)
  }

  async applyToState(
    state: Record<string, unknown>,
    event: StateEvent
  ): Promise<Record<string, unknown>> {
    return {
      ...state,
      ...event.eventData,
      version: event.version,
      lastUpdatedAt: event.timestamp.toISOString(),
    };
  }
}

class CanvasStateEventHandler implements EventHandler {
  async validate(event: StateEvent): Promise<void> {
    // Validate canvas state events
    if (event.eventType === 'component_added') {
      if (!event.eventData.component || !event.eventData.component.type) {
        throw new Error('Component data is required for component_added event');
      }
    }
  }

  async apply(event: StateEvent): Promise<void> {
    // Apply event to event store (already done)
  }

  async applyToState(
    state: Record<string, unknown>,
    event: StateEvent
  ): Promise<Record<string, unknown>> {
    const { eventType, eventData } = event;

    switch (eventType) {
      case 'component_added':
        return {
          ...state,
          components: [...(state.components || []), eventData.component],
        };

      case 'component_removed':
        return {
          ...state,
          components: (state.components || []).filter(
            c => c.id !== eventData.componentId
          ),
        };

      case 'component_updated':
        return {
          ...state,
          components: (state.components || []).map(c =>
            c.id === eventData.component.id ? eventData.component : c
          ),
        };

      default:
        return state;
    }
  }
}

// ============================================================================
// Supabase Event Store Implementation
// ============================================================================

class SupabaseEventStore implements EventStore {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async append(event: StateEvent): Promise<void> {
    const { error } = await this.supabase
      .from('state_events')
      .insert({
        id: event.id,
        tenant_id: event.metadata.tenantId,
        aggregate_id: event.aggregateId,
        aggregate_type: event.aggregateType,
        event_type: event.eventType,
        event_data: event.eventData,
        version: event.version,
        timestamp: event.timestamp.toISOString(),
        causation_id: event.causationId,
        correlation_id: event.correlationId,
        metadata: event.metadata,
      });

    if (error) {
      throw new Error(`Failed to append event: ${error.message}`);
    }
  }

  async getEvents(aggregateId: string, tenantId: string, fromVersion?: number): Promise<StateEvent[]> {
    let query = this.supabase
      .from('state_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('aggregate_id', aggregateId)
      .order('version', { ascending: true });

    if (fromVersion) {
      query = query.gte('version', fromVersion);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseRecord);
  }

  async getEvent(eventId: string, tenantId: string): Promise<StateEvent | null> {
    const { data, error } = await this.supabase
      .from('state_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get event: ${error.message}`);
    }

    return this.mapDatabaseRecord(data);
  }

  async getVersion(aggregateId: string, tenantId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('state_events')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('aggregate_id', aggregateId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return 0; // No events yet
      }
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return data?.version || 0;
  }

  private mapDatabaseRecord(record: any): StateEvent {
    return {
      id: record.id,
      aggregateId: record.aggregate_id,
      aggregateType: record.aggregate_type,
      eventType: record.event_type,
      eventData: record.event_data,
      version: record.version,
      timestamp: new Date(record.timestamp),
      causationId: record.causation_id,
      correlationId: record.correlation_id,
      metadata: record.metadata,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createEventSourcingManager(
  supabaseUrl: string,
  supabaseKey: string
): EventSourcingManager {
  return new EventSourcingManager(supabaseUrl, supabaseKey);
}
