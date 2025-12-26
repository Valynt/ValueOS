/**
 * AuditLogger Tests
 * Tests audit logging functionality and compliance
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogger } from '../AuditLogger';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(),
            })),
          })),
        })),
      })),
    };

    (createClient as any).mockReturnValue(mockSupabase);
    auditLogger = new AuditLogger(mockSupabase, 'test-org');
  });

  describe('Audit Log Creation', () => {
    it('should log agent execution events', async () => {
      const auditData = {
        action: 'agent.execute' as const,
        resource: 'agent-fabric',
        resourceId: 'agent-123',
        userId: 'user-456',
        sessionId: 'session-789',
        tenantId: 'tenant-101',
        metadata: {
          agentType: 'ValueMappingAgent',
          executionTime: 1500,
          cost: 0.05,
        },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'audit-1', ...auditData, timestamp: new Date().toISOString() }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await auditLogger.logAgentExecution(auditData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: auditData.action,
          resource: auditData.resource,
          resource_id: auditData.resourceId,
          user_id: auditData.userId,
          session_id: auditData.sessionId,
          tenant_id: auditData.tenantId,
          metadata: auditData.metadata,
        })
      );
      expect(result.id).toBe('audit-1');
    });

    it('should log LLM API calls', async () => {
      const auditData = {
        action: 'llm.call' as const,
        resource: 'llm-gateway',
        resourceId: 'call-123',
        userId: 'user-456',
        sessionId: 'session-789',
        tenantId: 'tenant-101',
        metadata: {
          provider: 'together',
          model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
          promptTokens: 150,
          completionTokens: 200,
          cost: 0.025,
          latencyMs: 1200,
        },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'audit-2', ...auditData, timestamp: new Date().toISOString() }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await auditLogger.logLLMCall(auditData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: auditData.action,
          resource: auditData.resource,
          metadata: expect.objectContaining({
            provider: 'together',
            model: auditData.metadata.model,
            promptTokens: 150,
            completionTokens: 200,
          }),
        })
      );
    });

    it('should log memory operations', async () => {
      const auditData = {
        action: 'memory.store' as const,
        resource: 'memory-system',
        resourceId: 'memory-123',
        userId: 'user-456',
        sessionId: 'session-789',
        tenantId: 'tenant-101',
        metadata: {
          memoryType: 'episodic',
          contentLength: 500,
          ttl: 86400,
        },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'audit-3', ...auditData, timestamp: new Date().toISOString() }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await auditLogger.logMemoryOperation(auditData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: auditData.action,
          resource: auditData.resource,
          metadata: expect.objectContaining({
            memoryType: 'episodic',
            contentLength: 500,
          }),
        })
      );
    });
  });

  describe('Audit Log Retrieval', () => {
    it('should retrieve audit logs by tenant', async () => {
      const tenantId = 'tenant-101';
      const mockLogs = [
        {
          id: 'audit-1',
          action: 'agent.execute',
          resource: 'agent-fabric',
          user_id: 'user-456',
          tenant_id: tenantId,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'audit-2',
          action: 'llm.call',
          resource: 'llm-gateway',
          user_id: 'user-456',
          tenant_id: tenantId,
          timestamp: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            })),
          })),
        })),
      });

      const logs = await auditLogger.getAuditLogs(tenantId, { limit: 10 });

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.tenant_id === tenantId)).toBe(true);
    });

    it('should filter audit logs by action type', async () => {
      const tenantId = 'tenant-101';
      const action = 'llm.call';

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{
                    id: 'audit-1',
                    action,
                    resource: 'llm-gateway',
                    tenant_id: tenantId,
                  }],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      const logs = await auditLogger.getAuditLogsByAction(tenantId, action);

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(action);
    });

    it('should retrieve audit logs by user', async () => {
      const userId = 'user-456';
      const tenantId = 'tenant-101';

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{
                    id: 'audit-1',
                    action: 'agent.execute',
                    user_id: userId,
                    tenant_id: tenantId,
                  }],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      const logs = await auditLogger.getAuditLogsByUser(tenantId, userId);

      expect(logs).toHaveLength(1);
      expect(logs[0].user_id).toBe(userId);
    });
  });

  describe('Compliance and Security', () => {
    it('should enforce tenant isolation in audit queries', async () => {
      const tenantId = 'tenant-a';
      const otherTenantId = 'tenant-b';

      // Mock query that should only return tenant-a data
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [{
                  id: 'audit-1',
                  tenant_id: tenantId,
                  action: 'agent.execute',
                }],
                error: null,
              }),
            })),
          })),
        })),
      });

      const logs = await auditLogger.getAuditLogs(tenantId);

      expect(logs.every(log => log.tenant_id === tenantId)).toBe(true);
      expect(logs.some(log => log.tenant_id === otherTenantId)).toBe(false);
    });

    it('should log security events', async () => {
      const securityEvent = {
        action: 'security.violation' as const,
        resource: 'circuit-breaker',
        resourceId: 'cb-123',
        userId: 'user-456',
        sessionId: 'session-789',
        tenantId: 'tenant-101',
        metadata: {
          violation: 'cost_limit_exceeded',
          threshold: 5.00,
          actual: 7.50,
          severity: 'high',
        },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'audit-security-1', ...securityEvent, timestamp: new Date().toISOString() }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await auditLogger.logSecurityEvent(securityEvent);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'security.violation',
          resource: 'circuit-breaker',
          metadata: expect.objectContaining({
            violation: 'cost_limit_exceeded',
            severity: 'high',
          }),
        })
      );
    });

    it('should support compliance reporting', async () => {
      const tenantId = 'tenant-101';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'audit-1',
                      action: 'agent.execute',
                      timestamp: '2024-06-15T10:30:00Z',
                      tenant_id: tenantId,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      const report = await auditLogger.generateComplianceReport(tenantId, startDate, endDate);

      expect(report).toHaveProperty('tenantId', tenantId);
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('totalEvents');
      expect(Array.isArray(report.events)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
        select: vi.fn(),
      });

      await expect(auditLogger.logAgentExecution({
        action: 'agent.execute',
        resource: 'test',
        resourceId: 'test-1',
        userId: 'user-1',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
      })).rejects.toThrow('Database connection failed');
    });

    it('should validate required audit fields', async () => {
      await expect(auditLogger.logAgentExecution({
        action: 'agent.execute',
        resource: 'test',
        resourceId: '', // Empty resourceId should fail
        userId: 'user-1',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
      })).rejects.toThrow('Resource ID cannot be empty');
    });
  });
});
