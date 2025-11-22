/**
 * Agent Audit Logger
 * 
 * Centralized logging system for all agent interactions with
 * database persistence and query capabilities.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { AgentType, AgentContext } from './AgentAPI';

/**
 * Audit log entry
 */
export interface AgentAuditLog {
  /**
   * Unique log ID
   */
  id?: string;

  /**
   * Agent name/type
   */
  agent_name: AgentType;

  /**
   * Input query
   */
  input_query: string;

  /**
   * Request context
   */
  context?: AgentContext;

  /**
   * Response data (sanitized)
   */
  response_data?: any;

  /**
   * Response metadata
   */
  response_metadata?: {
    duration: number;
    confidence?: number;
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };

  /**
   * Success status
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error_message?: string;

  /**
   * Timestamp
   */
  timestamp?: string;

  /**
   * User ID
   */
  user_id?: string;

  /**
   * Organization ID
   */
  organization_id?: string;

  /**
   * Session ID
   */
  session_id?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  /**
   * Filter by agent type
   */
  agent?: AgentType;

  /**
   * Filter by user ID
   */
  userId?: string;

  /**
   * Filter by organization ID
   */
  organizationId?: string;

  /**
   * Filter by session ID
   */
  sessionId?: string;

  /**
   * Filter by success status
   */
  success?: boolean;

  /**
   * Filter by date range (start)
   */
  startDate?: Date;

  /**
   * Filter by date range (end)
   */
  endDate?: Date;

  /**
   * Limit results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Audit log statistics
 */
export interface AuditLogStats {
  /**
   * Total requests
   */
  totalRequests: number;

  /**
   * Successful requests
   */
  successfulRequests: number;

  /**
   * Failed requests
   */
  failedRequests: number;

  /**
   * Average duration (ms)
   */
  averageDuration: number;

  /**
   * Average confidence
   */
  averageConfidence: number;

  /**
   * Requests by agent
   */
  byAgent: Record<AgentType, number>;

  /**
   * Requests over time
   */
  timeline?: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * Agent Audit Logger Class
 */
export class AgentAuditLogger {
  private static instance: AgentAuditLogger | null = null;
  private enableLogging: boolean = true;
  private logQueue: AgentAuditLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
  private readonly MAX_QUEUE_SIZE = 100;

  private constructor() {
    // Start auto-flush
    this.startAutoFlush();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentAuditLogger {
    if (!AgentAuditLogger.instance) {
      AgentAuditLogger.instance = new AgentAuditLogger();
    }
    return AgentAuditLogger.instance;
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Log agent interaction
   */
  async log(entry: Omit<AgentAuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.enableLogging) {
      return;
    }

    const logEntry: AgentAuditLog = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    this.logQueue.push(logEntry);

    // Flush if queue is full
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush log queue to database
   */
  async flush(): Promise<void> {
    if (this.logQueue.length === 0) {
      return;
    }

    const entries = [...this.logQueue];
    this.logQueue = [];

    try {
      const { error } = await supabase
        .from('agent_audit_logs')
        .insert(entries);

      if (error) {
        logger.error('Failed to flush audit logs', error instanceof Error ? error : undefined);
        // Re-add to queue on failure
        this.logQueue.unshift(...entries);
      }
    } catch (error) {
      logger.error('Error flushing audit logs', error instanceof Error ? error : undefined);
      // Re-add to queue on failure
      this.logQueue.unshift(...entries);
    }
  }

  /**
   * Query audit logs
   */
  async query(filters: AuditLogFilters = {}): Promise<AgentAuditLog[]> {
    let query = supabase
      .from('agent_audit_logs')
      .select('*');

    // Apply filters
    if (filters.agent) {
      query = query.eq('agent_name', filters.agent);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.organizationId) {
      query = query.eq('organization_id', filters.organizationId);
    }

    if (filters.sessionId) {
      query = query.eq('session_id', filters.sessionId);
    }

    if (filters.success !== undefined) {
      query = query.eq('success', filters.success);
    }

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate.toISOString());
    }

    // Sort
    query = query.order('timestamp', {
      ascending: filters.sortOrder === 'asc',
    });

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to query audit logs', error instanceof Error ? error : undefined);
      return [];
    }

    return data || [];
  }

  /**
   * Get audit log statistics
   */
  async getStats(filters: Omit<AuditLogFilters, 'limit' | 'offset' | 'sortOrder'> = {}): Promise<AuditLogStats> {
    const logs = await this.query({ ...filters, limit: 10000 });

    const stats: AuditLogStats = {
      totalRequests: logs.length,
      successfulRequests: logs.filter((log) => log.success).length,
      failedRequests: logs.filter((log) => !log.success).length,
      averageDuration: 0,
      averageConfidence: 0,
      byAgent: {} as Record<AgentType, number>,
    };

    if (logs.length > 0) {
      // Calculate averages
      const durations = logs
        .map((log) => log.response_metadata?.duration || 0)
        .filter((d) => d > 0);
      stats.averageDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length || 0;

      const confidences = logs
        .map((log) => log.response_metadata?.confidence || 0)
        .filter((c) => c > 0);
      stats.averageConfidence =
        confidences.reduce((sum, c) => sum + c, 0) / confidences.length || 0;

      // Count by agent
      logs.forEach((log) => {
        const agent = log.agent_name;
        stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
      });

      // Timeline (group by date)
      const timelineMap = new Map<string, number>();
      logs.forEach((log) => {
        const date = log.timestamp?.split('T')[0] || '';
        timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
      });

      stats.timeline = Array.from(timelineMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return stats;
  }

  /**
   * Get recent logs
   */
  async getRecent(limit: number = 50): Promise<AgentAuditLog[]> {
    return this.query({ limit, sortOrder: 'desc' });
  }

  /**
   * Get logs for a specific agent
   */
  async getByAgent(agent: AgentType, limit: number = 50): Promise<AgentAuditLog[]> {
    return this.query({ agent, limit, sortOrder: 'desc' });
  }

  /**
   * Get logs for a specific user
   */
  async getByUser(userId: string, limit: number = 50): Promise<AgentAuditLog[]> {
    return this.query({ userId, limit, sortOrder: 'desc' });
  }

  /**
   * Get logs for a specific session
   */
  async getBySession(sessionId: string): Promise<AgentAuditLog[]> {
    return this.query({ sessionId, sortOrder: 'asc' });
  }

  /**
   * Delete old logs
   */
  async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from('agent_audit_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select('id');

    if (error) {
      logger.error('Failed to delete old logs', error instanceof Error ? error : undefined);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Cleanup and stop logger
   */
  async cleanup(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }
}

/**
 * Get singleton instance
 */
export function getAuditLogger(): AgentAuditLogger {
  return AgentAuditLogger.getInstance();
}

/**
 * Helper function to log agent request
 */
export async function logAgentRequest(
  agent: AgentType,
  query: string,
  context?: AgentContext
): Promise<void> {
  const logger = getAuditLogger();
  await logger.log({
    agent_name: agent,
    input_query: query,
    context,
    success: true, // Will be updated on response
    user_id: context?.userId,
    organization_id: context?.organizationId,
    session_id: context?.sessionId,
  });
}

/**
 * Helper function to log agent response
 */
export async function logAgentResponse(
  agent: AgentType,
  query: string,
  success: boolean,
  responseData?: any,
  responseMetadata?: any,
  error?: string,
  context?: AgentContext
): Promise<void> {
  const logger = getAuditLogger();
  await logger.log({
    agent_name: agent,
    input_query: query,
    context,
    response_data: responseData,
    response_metadata: responseMetadata,
    success,
    error_message: error,
    user_id: context?.userId,
    organization_id: context?.organizationId,
    session_id: context?.sessionId,
  });
}

/**
 * Default export
 */
export default AgentAuditLogger;
