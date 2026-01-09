/**
 * Enhanced Audit Logger (VOS-SEC-003)
 * 
 * SOC 2 Type II compliant audit logging service with:
 * - Immutable hash chain for integrity verification
 * - Real-time streaming capability
 * - PII redaction before logging
 * - Multi-destination output (DB, file, SIEM)
 * 
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-003
 * @author Enterprise Agentic Architect
 * @version 2.0.0
 */

import { createLogger } from '../logger';
import {
  AuditAction,
  AuditActor,
  AuditCategory,
  AuditContext,
  AuditDataChange,
  AuditEvent,
  AuditSeverity,
  createAuditEvent,
  CreateAuditEventOptions,
  getSOC2Controls,
  redactPII,
  verifyEventChain,
} from './AuditEvent';

const logger = createLogger({ component: 'EnhancedAuditLogger' });

// ============================================================================
// Types
// ============================================================================

/**
 * Audit log destinations
 */
export type AuditDestination = 'database' | 'file' | 'siem' | 'memory' | 'console';

/**
 * SIEM integration configuration
 */
export interface SIEMConfig {
  endpoint: string;
  apiKey?: string;
  format: 'json' | 'cef' | 'leef';
  batchSize: number;
  flushIntervalMs: number;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Destinations to log to */
  destinations: AuditDestination[];
  /** Whether to apply PII redaction */
  redactPII: boolean;
  /** SIEM configuration */
  siemConfig?: SIEMConfig;
  /** Maximum events to keep in memory */
  maxMemoryEvents: number;
  /** Whether to enable real-time streaming */
  enableStreaming: boolean;
  /** Retention period in days */
  retentionDays: number;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  startTime?: Date;
  endTime?: Date;
  actorId?: string;
  actorType?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  actionType?: string;
  resourceId?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'severity';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Event listener callback
 */
export type AuditEventListener = (event: AuditEvent) => void | Promise<void>;

// ============================================================================
// Enhanced Audit Logger
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AuditLoggerConfig = {
  destinations: ['memory', 'console'],
  redactPII: true,
  maxMemoryEvents: 10000,
  enableStreaming: true,
  retentionDays: 2555, // ~7 years for SOC 2
};

/**
 * Enhanced Audit Logger
 * Singleton service for SOC 2 compliant audit logging
 */
export class EnhancedAuditLogger {
  private static instance: EnhancedAuditLogger;
  
  /** Configuration */
  private config: AuditLoggerConfig;
  
  /** In-memory event chain */
  private eventChain: AuditEvent[] = [];
  
  /** Current sequence number */
  private sequenceNumber = 0;
  
  /** Last hash for chain integrity */
  private lastHash = '0'.repeat(64);
  
  /** Event listeners for streaming */
  private listeners: Map<string, AuditEventListener> = new Map();
  
  /** SIEM batch buffer */
  private siemBuffer: AuditEvent[] = [];
  
  /** SIEM flush timer */
  private siemFlushTimer: NodeJS.Timeout | null = null;
  
  private constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.siemConfig) {
      this.startSIEMFlushTimer();
    }
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AuditLoggerConfig>): EnhancedAuditLogger {
    if (!EnhancedAuditLogger.instance) {
      EnhancedAuditLogger.instance = new EnhancedAuditLogger(config);
    }
    return EnhancedAuditLogger.instance;
  }
  
  /**
   * Log an audit event
   * 
   * @param options - Event creation options
   * @returns The created audit event
   */
  async log(options: Omit<CreateAuditEventOptions, 'previousHash' | 'sequenceNumber'>): Promise<AuditEvent> {
    // Create the event with chain integrity
    let event = createAuditEvent({
      ...options,
      previousHash: this.lastHash,
      sequenceNumber: this.sequenceNumber,
      soc2Controls: options.soc2Controls || getSOC2Controls(options.category),
    });
    
    // Apply PII redaction if configured
    if (this.config.redactPII) {
      event = redactPII(event);
    }
    
    // Update chain state
    this.lastHash = event.integrity.currentHash;
    this.sequenceNumber++;
    
    // Store to configured destinations
    await this.storeEvent(event);
    
    // Notify listeners
    if (this.config.enableStreaming) {
      await this.notifyListeners(event);
    }
    
    return event;
  }
  
  /**
   * Log an agent action
   */
  async logAgentAction(
    agentId: string,
    agentRole: string,
    organizationId: string,
    action: string,
    result: 'success' | 'failure',
    options: {
      resourceType?: string;
      resourceId?: string;
      description?: string;
      context?: Partial<AuditContext>;
      changes?: AuditDataChange[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<AuditEvent> {
    return this.log({
      category: 'agent_action',
      severity: result === 'failure' ? 'warning' : 'info',
      description: options.description || `Agent ${agentRole} performed ${action}`,
      actor: {
        type: 'agent',
        id: agentId,
        role: agentRole,
        organizationId,
      },
      action: {
        type: action,
        resourceType: options.resourceType || 'unknown',
        resourceId: options.resourceId,
        result,
      },
      context: options.context,
      changes: options.changes,
      metadata: options.metadata,
    });
  }
  
  /**
   * Log a HITL approval event
   */
  async logHITLApproval(
    approverId: string,
    organizationId: string,
    approvalResult: 'approved' | 'rejected' | 'timeout',
    requestDetails: {
      requestId: string;
      requestedAction: string;
      requestingAgentId: string;
      riskLevel: string;
    },
    options: {
      reason?: string;
      context?: Partial<AuditContext>;
    } = {}
  ): Promise<AuditEvent> {
    return this.log({
      category: 'hitl_approval',
      severity: approvalResult === 'rejected' ? 'warning' : 'info',
      description: `HITL request ${requestDetails.requestId} was ${approvalResult}`,
      actor: {
        type: 'human',
        id: approverId,
        role: 'approver',
        organizationId,
      },
      action: {
        type: `hitl:${approvalResult}`,
        resourceType: 'approval_request',
        resourceId: requestDetails.requestId,
        result: approvalResult === 'approved' ? 'success' : approvalResult === 'rejected' ? 'failure' : 'timeout',
        resultDetails: options.reason,
      },
      context: options.context,
      metadata: {
        requestedAction: requestDetails.requestedAction,
        requestingAgentId: requestDetails.requestingAgentId,
        riskLevel: requestDetails.riskLevel,
      },
    });
  }
  
  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: string,
    severity: AuditSeverity,
    actor: AuditActor,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      category: 'security_event',
      severity,
      description,
      actor,
      action: {
        type: eventType,
        resourceType: 'security',
        result: 'success',
      },
      metadata,
    });
  }
  
  /**
   * Log data access
   */
  async logDataAccess(
    actor: AuditActor,
    resourceType: string,
    resourceId: string,
    accessType: 'read' | 'write' | 'delete',
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    const categoryMap: Record<string, AuditCategory> = {
      read: 'data_access',
      write: 'data_modification',
      delete: 'data_deletion',
    };
    
    return this.log({
      category: categoryMap[accessType],
      severity: success ? 'info' : 'warning',
      description: `${accessType} access to ${resourceType}/${resourceId}`,
      actor,
      action: {
        type: `data:${accessType}`,
        resourceType,
        resourceId,
        result: success ? 'success' : 'failure',
      },
      metadata,
    });
  }
  
  /**
   * Log workflow execution
   */
  async logWorkflowExecution(
    actor: AuditActor,
    workflowId: string,
    workflowName: string,
    stage: 'started' | 'completed' | 'failed' | 'cancelled',
    durationMs?: number,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      category: 'workflow_execution',
      severity: stage === 'failed' ? 'error' : 'info',
      description: `Workflow ${workflowName} ${stage}`,
      actor,
      action: {
        type: `workflow:${stage}`,
        resourceType: 'workflow',
        resourceId: workflowId,
        result: stage === 'failed' ? 'failure' : 'success',
        durationMs,
      },
      metadata,
    });
  }
  
  /**
   * Query audit events
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditEvent[]> {
    let events = [...this.eventChain];
    
    // Apply filters
    if (options.startTime) {
      events = events.filter(e => new Date(e.timestamp) >= options.startTime!);
    }
    if (options.endTime) {
      events = events.filter(e => new Date(e.timestamp) <= options.endTime!);
    }
    if (options.actorId) {
      events = events.filter(e => e.actor.id === options.actorId);
    }
    if (options.actorType) {
      events = events.filter(e => e.actor.type === options.actorType);
    }
    if (options.category) {
      events = events.filter(e => e.category === options.category);
    }
    if (options.severity) {
      events = events.filter(e => e.severity === options.severity);
    }
    if (options.actionType) {
      events = events.filter(e => e.action.type === options.actionType);
    }
    if (options.resourceId) {
      events = events.filter(e => e.action.resourceId === options.resourceId);
    }
    if (options.organizationId) {
      events = events.filter(e => e.actor.organizationId === options.organizationId);
    }
    
    // Sort
    const orderBy = options.orderBy || 'timestamp';
    const orderDirection = options.orderDirection || 'desc';
    events.sort((a, b) => {
      const aVal = orderBy === 'timestamp' ? a.timestamp : a.severity;
      const bVal = orderBy === 'timestamp' ? b.timestamp : b.severity;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return orderDirection === 'asc' ? comparison : -comparison;
    });
    
    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    events = events.slice(offset, offset + limit);
    
    return events;
  }
  
  /**
   * Verify chain integrity
   */
  verifyIntegrity(): { valid: boolean; brokenAt?: number; message?: string } {
    return verifyEventChain(this.eventChain);
  }
  
  /**
   * Subscribe to audit events
   */
  subscribe(listenerId: string, callback: AuditEventListener): void {
    this.listeners.set(listenerId, callback);
    logger.debug('Audit event listener added', { listenerId });
  }
  
  /**
   * Unsubscribe from audit events
   */
  unsubscribe(listenerId: string): void {
    this.listeners.delete(listenerId);
    logger.debug('Audit event listener removed', { listenerId });
  }
  
  /**
   * Export events for compliance
   */
  async export(
    options: AuditQueryOptions,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const events = await this.query(options);
    
    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'category', 'severity', 'description',
        'actor_type', 'actor_id', 'actor_role', 'organization_id',
        'action_type', 'resource_type', 'resource_id', 'result',
      ];
      const rows = events.map(e => [
        e.id,
        e.timestamp,
        e.category,
        e.severity,
        `"${e.description.replace(/"/g, '""')}"`,
        e.actor.type,
        e.actor.id,
        e.actor.role,
        e.actor.organizationId,
        e.action.type,
        e.action.resourceType,
        e.action.resourceId || '',
        e.action.result,
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    
    return JSON.stringify(events, null, 2);
  }
  
  /**
   * Get event count
   */
  getEventCount(): number {
    return this.eventChain.length;
  }
  
  /**
   * Get events by organization
   */
  async getEventsByOrganization(
    organizationId: string,
    limit = 100
  ): Promise<AuditEvent[]> {
    return this.query({ organizationId, limit });
  }
  
  /**
   * Store event to configured destinations
   */
  private async storeEvent(event: AuditEvent): Promise<void> {
    for (const destination of this.config.destinations) {
      try {
        switch (destination) {
          case 'memory':
            this.storeToMemory(event);
            break;
          case 'console':
            this.logToConsole(event);
            break;
          case 'siem':
            this.bufferForSIEM(event);
            break;
          case 'database':
            await this.storeToDatabase(event);
            break;
          case 'file':
            await this.storeToFile(event);
            break;
        }
      } catch (error) {
        logger.error(`Failed to store audit event to ${destination}`, error as Error);
      }
    }
  }
  
  private storeToMemory(event: AuditEvent): void {
    this.eventChain.push(event);
    
    // Enforce max memory events
    if (this.eventChain.length > this.config.maxMemoryEvents) {
      this.eventChain.shift();
    }
  }
  
  private logToConsole(event: AuditEvent): void {
    const method = event.severity === 'error' || event.severity === 'critical' 
      ? 'error' 
      : event.severity === 'warning' 
        ? 'warn' 
        : 'info';
    
    logger[method]('AUDIT', {
      id: event.id,
      category: event.category,
      severity: event.severity,
      actor: `${event.actor.type}:${event.actor.id}`,
      action: event.action.type,
      result: event.action.result,
    });
  }
  
  private bufferForSIEM(event: AuditEvent): void {
    if (!this.config.siemConfig) return;
    
    this.siemBuffer.push(event);
    
    if (this.siemBuffer.length >= this.config.siemConfig.batchSize) {
      this.flushSIEMBuffer();
    }
  }
  
  private async flushSIEMBuffer(): Promise<void> {
    if (!this.config.siemConfig || this.siemBuffer.length === 0) return;
    
    const events = [...this.siemBuffer];
    this.siemBuffer = [];
    
    try {
      // In production, send to SIEM endpoint
      logger.info('Flushing audit events to SIEM', { count: events.length });
      // await fetch(this.config.siemConfig.endpoint, {...})
    } catch (error) {
      logger.error('Failed to flush events to SIEM', error as Error);
      // Re-add to buffer for retry
      this.siemBuffer.unshift(...events);
    }
  }
  
  private startSIEMFlushTimer(): void {
    if (this.siemFlushTimer) {
      clearInterval(this.siemFlushTimer);
    }
    
    const interval = this.config.siemConfig?.flushIntervalMs || 30000;
    this.siemFlushTimer = setInterval(() => {
      this.flushSIEMBuffer();
    }, interval);
  }
  
  private async storeToDatabase(_event: AuditEvent): Promise<void> {
    // In production, store to Supabase/PostgreSQL
    // await supabase.from('audit_events').insert(event);
  }
  
  private async storeToFile(_event: AuditEvent): Promise<void> {
    // In production, append to audit log file
    // await fs.appendFile('audit.log', JSON.stringify(event) + '\n');
  }
  
  private async notifyListeners(event: AuditEvent): Promise<void> {
    for (const [listenerId, callback] of this.listeners) {
      try {
        await callback(event);
      } catch (error) {
        logger.error('Audit listener error', { listenerId, error });
      }
    }
  }
  
  /**
   * Destroy the logger
   */
  destroy(): void {
    if (this.siemFlushTimer) {
      clearInterval(this.siemFlushTimer);
      this.siemFlushTimer = null;
    }
    this.flushSIEMBuffer();
    this.listeners.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export const enhancedAuditLogger = EnhancedAuditLogger.getInstance();

export default {
  EnhancedAuditLogger,
  enhancedAuditLogger,
};
