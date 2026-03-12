import { vi } from 'vitest';
/**
 * Simplified Integration Test for Canvas Workspace
 *
 * Tests the core pipeline without complex dependencies.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandProcessor } from '../../lib/commands/CommandProcessor';

// Simple test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Canvas Workspace Core Integration', () => {
  let processor: CommandProcessor;

  beforeEach(() => {
    processor = new CommandProcessor({
      maxHistorySize: 10,
      enableUndo: true,
    });
  });

  describe('Command Processor', () => {
    it('should execute commands and maintain history', async () => {
      const mockCommand = {
        id: 'test-1',
        type: 'test',
        timestamp: Date.now(),
        description: 'Test command',
        execute: async () => ({ success: true, data: 'test-result' }),
        canUndo: () => false,
      };

      const result = await processor.execute(mockCommand);

      expect(result.success).toBe(true);
      expect(result.data).toBe('test-result');
      expect(processor.getHistory()).toHaveLength(1);
      expect(processor.canUndo()).toBe(false);
      expect(processor.canRedo()).toBe(false);
    });

    it('should support undo operations', async () => {
      const mockCommand = {
        id: 'test-2',
        type: 'test',
        timestamp: Date.now(),
        description: 'Test undoable command',
        execute: async () => ({ success: true, data: 'test-result' }),
        undo: async () => {},
        canUndo: () => true,
      };

      await processor.execute(mockCommand);
      expect(processor.canUndo()).toBe(true);

      const undoResult = await processor.undo();
      expect(undoResult).toBe(true);
      expect(processor.canUndo()).toBe(false);
      expect(processor.canRedo()).toBe(true);
    });

    it('should handle command errors gracefully', async () => {
      const mockCommand = {
        id: 'test-3',
        type: 'test',
        timestamp: Date.now(),
        description: 'Test failing command',
        execute: async () => {
          throw new Error('Command failed');
        },
        canUndo: () => false,
      };

      const result = await processor.execute(mockCommand);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Command failed');
    });

    it('should queue commands when processing', async () => {
      let processingCount = 0;

      const slowCommand = {
        id: 'slow-1',
        type: 'test',
        timestamp: Date.now(),
        description: 'Slow command',
        execute: async () => {
          processingCount++;
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, data: 'slow-result' };
        },
        canUndo: () => false,
      };

      const fastCommand = {
        id: 'fast-1',
        type: 'test',
        timestamp: Date.now(),
        description: 'Fast command',
        execute: async () => {
          processingCount++;
          return { success: true, data: 'fast-result' };
        },
        canUndo: () => false,
      };

      // Execute both commands
      const slowPromise = processor.execute(slowCommand);
      const fastPromise = processor.execute(fastCommand);

      await slowPromise;
      await fastPromise;

      expect(processingCount).toBe(2);
      expect(processor.getHistory()).toHaveLength(2);
    });
  });

  describe('Command History Management', () => {
    it('should limit history size', async () => {
      const smallProcessor = new CommandProcessor({ maxHistorySize: 3 });

      // Add 5 commands
      for (let i = 0; i < 5; i++) {
        const command = {
          id: `test-${i}`,
          type: 'test',
          timestamp: Date.now(),
          description: `Test command ${i}`,
          execute: async () => ({ success: true, data: `result-${i}` }),
          canUndo: () => true,
        };
        await smallProcessor.execute(command);
      }

      // Should only keep last 3
      expect(smallProcessor.getHistory()).toHaveLength(3);
      expect(smallProcessor.getHistory()[0].command.id).toBe('test-2');
      expect(smallProcessor.getHistory()[2].command.id).toBe('test-4');
    });

    it('should clear history properly', async () => {
      const command = {
        id: 'test-clear',
        type: 'test',
        timestamp: Date.now(),
        description: 'Test clear command',
        execute: async () => ({ success: true, data: 'test-result' }),
        canUndo: () => false,
      };

      await processor.execute(command);
      expect(processor.getHistory()).toHaveLength(1);

      processor.clearHistory();
      expect(processor.getHistory()).toHaveLength(0);
      expect(processor.canUndo()).toBe(false);
      expect(processor.canRedo()).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should track execution time', async () => {
      const command = {
        id: 'perf-test',
        type: 'test',
        timestamp: Date.now(),
        description: 'Performance test command',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { success: true, data: 'perf-result' };
        },
        canUndo: () => false,
      };

      await processor.execute(command);

      const history = processor.getHistory();
      expect(history[0].result.executionTime).toBeGreaterThan(40);
      expect(history[0].result.executionTime).toBeLessThan(200);
    });

    it('should handle concurrent commands', async () => {
      const commands = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        type: 'test',
        timestamp: Date.now(),
        description: `Concurrent command ${i}`,
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
          return { success: true, data: `result-${i}` };
        },
        canUndo: () => false,
      }));

      const startTime = Date.now();
      const results = await Promise.all(commands.map(cmd => processor.execute(cmd)));
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(processor.getHistory()).toHaveLength(10);

      // Should complete in reasonable time (concurrent execution)
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
});

/**
 * Mock implementation for testing hooks without full dependencies
 */
export const mockUseCanvasCommand = () => ({
  processCommand: vi.fn().mockResolvedValue({ success: true }),
  isProcessing: false,
  canProcess: true,
});

export const mockUseCanvasSession = () => ({
  sessionId: 'test-session',
  workflowState: { currentStage: 'opportunity' },
  selectedCaseId: 'test-case',
  selectedCase: { id: 'test-case', name: 'Test Case' },
  isLoading: false,
  error: null,
  cases: [],
  inProgressCases: [],
  completedCases: [],
  selectCase: vi.fn(),
  createNewCase: vi.fn(),
  updateWorkflowState: vi.fn(),
  clearSession: vi.fn(),
  refreshSession: vi.fn(),
  refetchCases: vi.fn(),
  isSessionValid: true,
  currentUserId: 'test-user',
  currentTenantId: 'test-tenant',
  userEmail: 'test@example.com',
  userCreatedAt: '2024-01-01T00:00:00Z',
  workflowStateService: {
    loadOrCreateSession: vi.fn(),
    saveWorkflowState: vi.fn(),
  },
});

export const mockUseCommandProcessor = () => ({
  executeCommand: vi.fn().mockResolvedValue({ success: true }),
  undo: vi.fn().mockResolvedValue(true),
  redo: vi.fn().mockResolvedValue(true),
  clearHistory: vi.fn(),
  isProcessing: false,
  canUndo: false,
  canRedo: false,
  history: [],
  historyIndex: -1,
  queuedCommands: 0,
  processor: new CommandProcessor(),
});
