/**
 * Audit Log Service
 * Logging and retrieving audit events with filtering
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { AuditLogEntry } from '../types';

export interface AuditLogCreateInput {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  status?: 'success' | 'failed';
  limit?: number;
  offset?: number;
}

export interface AuditLogExportOptions {
  format: 'csv' | 'json';
  query?: AuditLogQuery;
}

export class AuditLogService extends BaseService {
  constructor() {
    super('AuditLogService');
  }

  /**
   * Create an audit log entry
   */
  async log(input: AuditLogCreateInput): Promise<AuditLogEntry> {
    this.validateRequired(input, [
      'userId',
      'userName',
      'userEmail',
      'action',
      'resourceType',
      'resourceId',
    ]);

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('audit_logs')
          .insert({
            user_id: input.userId,
            user_name: input.userName,
            user_email: input.userEmail,
            action: input.action,
            resource_type: input.resourceType,
            resource_id: input.resourceId,
            details: input.details || {},
            ip_address: input.ipAddress || '',
            user_agent: input.userAgent || '',
            status: input.status || 'success',
            timestamp: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      { skipCache: true }
    );
  }

  /**
   * Query audit logs with filters
   */
  async query(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
    this.log('info', 'Querying audit logs', query);

    return this.executeRequest(
      async () => {
        let dbQuery = this.supabase.from('audit_logs').select('*');

        if (query.userId) {
          dbQuery = dbQuery.eq('user_id', query.userId);
        }

        if (query.action) {
          dbQuery = dbQuery.eq('action', query.action);
        }

        if (query.resourceType) {
          dbQuery = dbQuery.eq('resource_type', query.resourceType);
        }

        if (query.status) {
          dbQuery = dbQuery.eq('status', query.status);
        }

        if (query.startDate) {
          dbQuery = dbQuery.gte('timestamp', query.startDate);
        }

        if (query.endDate) {
          dbQuery = dbQuery.lte('timestamp', query.endDate);
        }

        dbQuery = dbQuery.order('timestamp', { ascending: false });

        if (query.limit) {
          dbQuery = dbQuery.limit(query.limit);
        }

        if (query.offset) {
          dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 50) - 1);
        }

        const { data, error } = await dbQuery;

        if (error) throw error;
        return data || [];
      },
      {
        deduplicationKey: `audit-logs-${JSON.stringify(query)}`,
      }
    );
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string): Promise<AuditLogEntry | null> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('audit_logs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      {
        deduplicationKey: `audit-log-${id}`,
      }
    );
  }

  /**
   * Export audit logs
   */
  async export(options: AuditLogExportOptions): Promise<string> {
    this.log('info', 'Exporting audit logs', options);

    const logs = await this.query(options.query);

    if (options.format === 'csv') {
      return this.exportToCsv(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string; count: number }>;
  }> {
    return this.executeRequest(
      async () => {
        const logs = await this.query({ startDate, endDate });

        const totalEvents = logs.length;
        const successfulEvents = logs.filter((l) => l.status === 'success').length;
        const failedEvents = logs.filter((l) => l.status === 'failed').length;

        const actionCounts = new Map<string, number>();
        logs.forEach((log) => {
          actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
        });

        const topActions = Array.from(actionCounts.entries())
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const userCounts = new Map<string, { userName: string; count: number }>();
        logs.forEach((log) => {
          const existing = userCounts.get(log.userId) || {
            userName: log.userName,
            count: 0,
          };
          userCounts.set(log.userId, {
            userName: log.userName,
            count: existing.count + 1,
          });
        });

        const topUsers = Array.from(userCounts.entries())
          .map(([userId, data]) => ({ userId, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          totalEvents,
          successfulEvents,
          failedEvents,
          topActions,
          topUsers,
        };
      },
      {
        deduplicationKey: `audit-stats-${startDate}-${endDate}`,
      }
    );
  }

  /**
   * Convert logs to CSV format
   */
  private exportToCsv(logs: AuditLogEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.userName,
      log.userEmail,
      log.action,
      log.resourceType,
      log.resourceId,
      log.status,
      log.ipAddress,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Delete old audit logs (data retention)
   */
  async deleteOldLogs(olderThan: string): Promise<number> {
    this.log('info', 'Deleting old audit logs', { olderThan });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('audit_logs')
          .delete()
          .lt('timestamp', olderThan)
          .select('id');

        if (error) throw error;

        const deletedCount = data?.length || 0;
        this.log('info', `Deleted ${deletedCount} old audit logs`);

        this.clearCache();
        return deletedCount;
      },
      { skipCache: true }
    );
  }
}

export const auditLogService = new AuditLogService();
