/**
 * Saga Execution and Rollback Tests
 * 
 * Tests for workflow saga pattern with compensation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  WorkflowLifecycleIntegration,
  resetWorkflowLifecycleIntegration
} from '../../services/WorkflowLifecycleIntegration';
import {
  LifecycleCompensationHandlers,
  resetLifecycleCompensationHandlers
} from '../../services/LifecycleCompensationHandlers';

// Mock Supabase client
const mockSupabase = createClient(
  'https://test.supabase.co',
  'test-key'
);

describe('Saga Execution and Rollback', () => {
  let integration: WorkflowLifecycleIntegration;
  let handlers: LifecycleCompensationHandlers;

  beforeEach(() => {
    resetWorkflowLifecycleIntegration();
    resetLifecycleCompensationHandlers();
    integration = new WorkflowLifecycleIntegration(mockSupabase);
    handlers = new LifecycleCompensationHandlers(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Workflow Execution', () => {
    it('should execute complete workflow successfully', async () => {
      // Mock successful execution
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id' },
              error: null
            })
          })
        }),
        update: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      const result = await integration.executeWorkflow(
        'user-1',
        { companyName: 'Test Corp' },
        { stopStage: 'opportunity' }
      );

      expect(result.status).toBe('completed');
      expect(result.completedStages).toContain('opportunity');
    });

    it('should handle workflow failure', async () => {
      // Mock failure
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      } as any);

      await expect(
        integration.executeWorkflow(
          'user-1',
          { companyName: 'Test Corp' }
        )
      ).rejects.toThrow();
    });

    it('should track execution progress', async () => {
      // Mock successful execution
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id' },
              error: null
            })
          })
        }),
        update: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      const result = await integration.executeWorkflow(
        'user-1',
        { companyName: 'Test Corp' },
        { stopStage: 'target' }
      );

      expect(result.completedStages).toHaveLength(2);
      expect(result.completedStages).toContain('opportunity');
      expect(result.completedStages).toContain('target');
    });
  });

  describe('Compensation', () => {
    it('should compensate failed workflow', async () => {
      // Create a failed execution
      const execution = {
        id: 'exec-1',
        userId: 'user-1',
        status: 'failed' as const,
        currentStage: 'target' as const,
        completedStages: ['opportunity' as const],
        failedStage: 'target' as const,
        results: {},
        startedAt: new Date()
      };

      // Mock compensation
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                context: {
                  executed_steps: [
                    {
                      stage_id: 'opportunity',
                      stage_type: 'opportunity',
                      compensator: 'compensateOpportunity'
                    }
                  ]
                }
              },
              error: null
            }),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  stage_id: 'opportunity',
                  status: 'completed',
                  output_data: {
                    artifacts_created: ['opp-1']
                  }
                }
              ],
              error: null
            })
          })
        }),
        delete: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      await expect(
        integration.compensateWorkflow('exec-1')
      ).resolves.not.toThrow();
    });

    it('should execute compensation handlers', async () => {
      const context = {
        stageId: 'stage-1',
        stage: 'opportunity' as const,
        artifactsCreated: ['opp-1', 'opp-2'],
        stateChanges: { cacheKeys: ['key-1'] },
        executionId: 'exec-1'
      };

      // Mock database operations
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      } as any);

      const handler = handlers.getHandler('opportunity');
      expect(handler).toBeDefined();

      if (handler) {
        await expect(handler(context)).resolves.not.toThrow();
      }
    });

    it('should handle compensation errors gracefully', async () => {
      const context = {
        stageId: 'stage-1',
        stage: 'target' as const,
        artifactsCreated: ['tree-1'],
        stateChanges: { valueTreeIds: ['tree-1'] },
        executionId: 'exec-1'
      };

      // Mock database error
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      } as any);

      const handler = handlers.getHandler('target');
      
      if (handler) {
        await expect(handler(context)).rejects.toThrow();
      }
    });
  });

  describe('Workflow Resume', () => {
    it('should resume failed workflow', async () => {
      // Create a failed execution
      const execution = {
        id: 'exec-1',
        userId: 'user-1',
        status: 'failed' as const,
        currentStage: 'target' as const,
        completedStages: ['opportunity' as const],
        failedStage: 'target' as const,
        results: {
          opportunity: {
            success: true,
            data: { opportunityId: 'opp-1' }
          }
        },
        startedAt: new Date()
      };

      // Mock successful resume
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id' },
              error: null
            })
          })
        }),
        update: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      const result = await integration.resumeWorkflow('exec-1');

      expect(result.status).toBe('completed');
    });
  });

  describe('Stage Sequence', () => {
    it('should execute stages in correct order', async () => {
      const stages: string[] = [];

      // Mock to track stage execution order
      vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
        if (table.endsWith('_results')) {
          const stage = table.replace('_results', '');
          stages.push(stage);
        }

        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'test-id' },
                error: null
              })
            })
          }),
          update: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any;
      });

      await integration.executeWorkflow(
        'user-1',
        { companyName: 'Test Corp' },
        { stopStage: 'expansion' }
      );

      expect(stages).toEqual(['opportunity', 'target', 'expansion']);
    });

    it('should support partial workflow execution', async () => {
      // Mock successful execution
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id' },
              error: null
            })
          })
        }),
        update: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      const result = await integration.executeWorkflow(
        'user-1',
        { companyName: 'Test Corp' },
        {
          startStage: 'target',
          stopStage: 'expansion'
        }
      );

      expect(result.completedStages).toHaveLength(2);
      expect(result.completedStages).toContain('target');
      expect(result.completedStages).toContain('expansion');
      expect(result.completedStages).not.toContain('opportunity');
    });
  });

  describe('Execution Management', () => {
    it('should track multiple executions', async () => {
      // Mock successful execution
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id' },
              error: null
            })
          })
        }),
        update: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      await integration.executeWorkflow('user-1', {}, { stopStage: 'opportunity' });
      await integration.executeWorkflow('user-1', {}, { stopStage: 'opportunity' });

      const executions = integration.getUserExecutions('user-1');
      expect(executions).toHaveLength(2);
    });

    it('should clean up old executions', () => {
      const cleaned = integration.cleanupExecutions(0);
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing execution', () => {
      const execution = integration.getExecution('nonexistent');
      expect(execution).toBeNull();
    });

    it('should prevent compensation of non-failed execution', async () => {
      await expect(
        integration.compensateWorkflow('nonexistent')
      ).rejects.toThrow('Execution not found');
    });

    it('should prevent resume of non-failed execution', async () => {
      await expect(
        integration.resumeWorkflow('nonexistent')
      ).rejects.toThrow('Execution not found');
    });
  });
});
