/**
 * Resilience Testing
 * 
 * Tests system resilience including:
 * - Circuit breaker verification
 * - Compensation scenario testing
 * - Database failover simulation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../lib/resilience/CircuitBreaker';
import { getWorkflowLifecycleIntegration, resetWorkflowLifecycleIntegration } from '../../services/WorkflowLifecycleIntegration';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = createClient('https://test.supabase.co', 'test-key');

describe('Resilience Testing', () => {
  describe('Circuit Breaker Verification', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(3, 5000, 2); // 3 failures, 5s timeout, 2 successes
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open after threshold failures', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Execute failing operations
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when OPEN', async () => {
      // Force circuit open
      circuitBreaker.forceOpen();

      const operation = async () => 'success';

      await expect(
        circuitBreaker.execute(operation)
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Open circuit
      const failingOp = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(failingOp); } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Next request should transition to HALF_OPEN
      const successOp = async () => 'success';
      await circuitBreaker.execute(successOp);

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close after successful recovery', async () => {
      // Open circuit
      const failingOp = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(failingOp); } catch {}
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Execute successful operations
      const successOp = async () => 'success';
      await circuitBreaker.execute(successOp);
      await circuitBreaker.execute(successOp);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen if failure occurs in HALF_OPEN', async () => {
      // Open circuit
      const failingOp = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(failingOp); } catch {}
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Try to recover but fail
      try {
        await circuitBreaker.execute(failingOp);
      } catch {}

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should track statistics', async () => {
      const successOp = async () => 'success';
      const failOp = async () => { throw new Error('fail'); };

      // Execute some operations
      await circuitBreaker.execute(successOp);
      await circuitBreaker.execute(successOp);
      try { await circuitBreaker.execute(failOp); } catch {}

      const stats = circuitBreaker.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.failures).toBeGreaterThan(0);
      expect(stats.successes).toBeGreaterThan(0);
    });

    it('should handle concurrent requests', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };

      const promises = Array.from({ length: 10 }, () =>
        circuitBreaker.execute(operation)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r === 'success')).toBe(true);
    });

    it('should reset correctly', async () => {
      // Open circuit
      const failingOp = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(failingOp); } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats().totalRequests).toBe(0);
    });
  });

  describe('Compensation Scenario Testing', () => {
    let integration: any;

    beforeEach(() => {
      resetWorkflowLifecycleIntegration();
      integration = getWorkflowLifecycleIntegration(mockSupabase);
    });

    it('should compensate on workflow failure', async () => {
      // Mock database operations
      let deletesCalled = 0;

      vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          }),
          delete: vi.fn().mockImplementation(() => {
            deletesCalled++;
            return {
              in: vi.fn().mockResolvedValue({ data: null, error: null })
            };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { context: { executed_steps: [] } },
                error: null
              })
            })
          })
        } as any;
      });

      // Execute workflow that will fail
      try {
        await integration.executeWorkflow(
          'user-1',
          { companyName: 'Test' },
          { autoCompensate: true }
        );
      } catch (error) {
        // Expected to fail
      }

      // Verify compensation was attempted
      expect(deletesCalled).toBeGreaterThan(0);
    });

    it('should handle partial compensation failure', async () => {
      let compensationAttempts = 0;

      vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
        return {
          delete: vi.fn().mockImplementation(() => {
            compensationAttempts++;
            if (compensationAttempts === 1) {
              // First compensation succeeds
              return {
                in: vi.fn().mockResolvedValue({ data: null, error: null })
              };
            } else {
              // Second compensation fails
              return {
                in: vi.fn().mockRejectedValue(new Error('Compensation failed'))
              };
            }
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  context: {
                    executed_steps: [
                      { stage_id: 'stage1' },
                      { stage_id: 'stage2' }
                    ]
                  }
                },
                error: null
              }),
              order: vi.fn().mockResolvedValue({
                data: [
                  { stage_id: 'stage1', status: 'completed' },
                  { stage_id: 'stage2', status: 'completed' }
                ],
                error: null
              })
            })
          })
        } as any;
      });

      // Attempt compensation
      try {
        await integration.compensateWorkflow('exec-1');
      } catch (error) {
        // Expected to fail on second compensation
      }

      expect(compensationAttempts).toBeGreaterThan(1);
    });

    it('should maintain data consistency during compensation', async () => {
      const deletedItems: string[] = [];

      vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockImplementation((ids: string[]) => {
              deletedItems.push(...ids);
              return Promise.resolve({ data: null, error: null });
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  context: {
                    executed_steps: [
                      {
                        stage_id: 'stage1',
                        output_data: { artifacts_created: ['item1', 'item2'] }
                      }
                    ]
                  }
                },
                error: null
              }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    stage_id: 'stage1',
                    status: 'completed',
                    output_data: { artifacts_created: ['item1', 'item2'] }
                  }
                ],
                error: null
              })
            })
          })
        } as any;
      });

      await integration.compensateWorkflow('exec-1');

      // Verify all artifacts were deleted
      expect(deletedItems).toContain('item1');
      expect(deletedItems).toContain('item2');
    });
  });

  describe('Database Failover Simulation', () => {
    it('should handle database connection failure', async () => {
      const failingSupabase = createClient('https://test.supabase.co', 'test-key');

      vi.spyOn(failingSupabase, 'from').mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const integration = getWorkflowLifecycleIntegration(failingSupabase);

      await expect(
        integration.executeWorkflow('user-1', { companyName: 'Test' })
      ).rejects.toThrow();
    });

    it('should retry on transient database errors', async () => {
      let attempts = 0;

      vi.spyOn(mockSupabase, 'from').mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
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
          update: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any;
      });

      const integration = getWorkflowLifecycleIntegration(mockSupabase);

      // Should succeed after retries
      const result = await integration.executeWorkflow(
        'user-1',
        { companyName: 'Test' },
        { stopStage: 'opportunity' }
      );

      expect(attempts).toBeGreaterThanOrEqual(3);
      expect(result.status).toBe('completed');
    });

    it('should handle database timeout', async () => {
      vi.spyOn(mockSupabase, 'from').mockImplementation(() => {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                return new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout')), 100);
                });
              })
            })
          })
        } as any;
      });

      const integration = getWorkflowLifecycleIntegration(mockSupabase);

      await expect(
        integration.executeWorkflow('user-1', { companyName: 'Test' })
      ).rejects.toThrow('Timeout');
    });

    it('should handle read replica failure', async () => {
      let readAttempts = 0;

      vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
        if (table.includes('_read')) {
          readAttempts++;
          throw new Error('Read replica unavailable');
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        } as any;
      });

      // Should fallback to primary
      const { data } = await mockSupabase.from('test').select('*');
      expect(data).toBeDefined();
    });
  });

  describe('Cascading Failure Prevention', () => {
    it('should prevent cascading failures with circuit breaker', async () => {
      const circuitBreaker = new CircuitBreaker(3, 5000, 2);
      let failedRequests = 0;
      let rejectedRequests = 0;

      const failingService = async () => {
        failedRequests++;
        throw new Error('Service unavailable');
      };

      // Trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(failingService);
        } catch (error) {
          if (error.message.includes('Circuit breaker is OPEN')) {
            rejectedRequests++;
          }
        }
      }

      // Circuit should be open, preventing further requests
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(rejectedRequests).toBeGreaterThan(0);
      expect(failedRequests).toBeLessThan(10); // Not all requests reached service
    });

    it('should isolate failures between services', async () => {
      const serviceA = new CircuitBreaker(3, 5000, 2);
      const serviceB = new CircuitBreaker(3, 5000, 2);

      const failingOp = async () => { throw new Error('fail'); };

      // Fail service A
      for (let i = 0; i < 3; i++) {
        try { await serviceA.execute(failingOp); } catch {}
      }

      // Service A should be open
      expect(serviceA.getState()).toBe(CircuitState.OPEN);

      // Service B should still be closed
      expect(serviceB.getState()).toBe(CircuitState.CLOSED);

      // Service B should still work
      const successOp = async () => 'success';
      const result = await serviceB.execute(successOp);
      expect(result).toBe('success');
    });
  });

  describe('Recovery Testing', () => {
    it('should recover gracefully after service restoration', async () => {
      const circuitBreaker = new CircuitBreaker(3, 1000, 2);
      let serviceHealthy = false;

      const service = async () => {
        if (!serviceHealthy) {
          throw new Error('Service down');
        }
        return 'success';
      };

      // Break the circuit
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(service); } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Restore service
      serviceHealthy = true;

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should recover
      await circuitBreaker.execute(service);
      await circuitBreaker.execute(service);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should handle intermittent failures during recovery', async () => {
      const circuitBreaker = new CircuitBreaker(3, 1000, 2);
      let failureRate = 1.0; // 100% failure

      const service = async () => {
        if (Math.random() < failureRate) {
          throw new Error('Intermittent failure');
        }
        return 'success';
      };

      // Break the circuit
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(service); } catch {}
      }

      // Improve service gradually
      failureRate = 0.5; // 50% failure
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Try to recover (may take multiple attempts)
      let recovered = false;
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(service);
          await circuitBreaker.execute(service);
          recovered = true;
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }

      expect(recovered).toBe(true);
    });
  });
});
