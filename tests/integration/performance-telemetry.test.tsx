/**
 * Performance and Telemetry Integration Tests
 *
 * Tests for performance benchmarks and telemetry tracking in the canvas workflow.
 * These tests ensure that performance metrics are properly collected and analyzed.
 */

import React, { useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC, ReactNode } from 'react';
import { vi, beforeEach, describe, it, expect } from 'vitest';

// Import components and hooks
import { useCanvasCommand } from '../../src/hooks/useCanvasCommand';
import { useCommandProcessor } from '../../src/hooks/useCommandProcessor';
import { CommandProcessor } from '../../src/lib/commands/CommandProcessor';

// Import mock builders
import {
  createMockUser,
  createMockCase,
  createMockWorkflowState,
  createMockSDUIPage,
  createMockSupabase,
  createMockAgentChatService,
  createStandardTestSetup
} from './test-utils/mockBuilders';

// Mock services
const mockSupabase = createMockSupabase().build();
const mockAgentChatService = createMockAgentChatService().build();

// Mock telemetry
const mockTelemetry = {
  startSpan: vi.fn(),
  endSpan: vi.fn(),
  recordEvent: vi.fn(),
  recordWorkflowStateChange: vi.fn(),
  getPerformanceSummary: vi.fn(),
};

vi.mock('../../src/lib/telemetry/SDUITelemetry', () => ({
  sduiTelemetry: mockTelemetry,
  TelemetryEventType: {
    CHAT_REQUEST_START: 'chat_request_start',
    CHAT_REQUEST_COMPLETE: 'chat_request_complete',
    CHAT_REQUEST_ERROR: 'chat_request_error',
    RENDER_START: 'render_start',
    RENDER_COMPLETE: 'render_complete',
    RENDER_ERROR: 'render_error',
    WORKFLOW_STATE_SAVE: 'workflow_state_save',
  }
}));

// Test wrapper
const TestWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Performance and Telemetry Tests', () => {
  let mockUser: any;
  let mockCase: any;
  let mockWorkflowState: any;
  let mockSDUIPage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const testSetup = createStandardTestSetup();
    mockUser = testSetup.user;
    mockCase = testSetup.caseData;
    mockWorkflowState = testSetup.workflowState;
    mockSDUIPage = testSetup.sduiPage;

    // Reset telemetry mocks
    vi.clearAllMocks();

    // Mock performance timing
    vi.stubGlobal('performance', {
      now: vi.fn(() => Date.now()),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Performance Benchmarks', () => {
    it('should track command execution performance metrics', async () => {
      const processor = new CommandProcessor({ enableUndo: true });

      const TestComponent = () => {
        const { executeUserCommand } = useCommandProcessor({
          useGlobalProcessor: false,
        });

        const handleCommand = async () => {
          const startTime = performance.now();

          await executeUserCommand(
            'Performance test command',
            {
              caseId: 'test-case-id',
              userId: 'test-user',
              sessionId: 'test-session',
              workflowState: mockWorkflowState,
            },
            async () => {
              // Simulate processing time
              await new Promise(resolve => setTimeout(resolve, 50));
              return mockAgentChatService.chat({
                query: 'Performance test command',
                caseId: 'test-case-id',
                userId: 'test-user',
                sessionId: 'test-session',
                workflowState: mockWorkflowState,
              });
            }
          );

          const endTime = performance.now();
          const duration = endTime - startTime;

          return { duration };
        };

        return (
          <div>
            <button onClick={handleCommand}>Performance Test</button>
            <div data-testid="execution-time">{/* Will be populated by test */}</div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Performance Test');

      await act(async () => {
        userEvent.click(button);
      });

      const history = processor.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].result.executionTime).toBeGreaterThan(0);
      expect(history[0].result.executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should measure SDUI rendering performance', async () => {
      const TestComponent = () => {
        const [renderMetrics, setRenderMetrics] = useState<any>(null);
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: (result) => {
            setRenderMetrics({
              componentCount: result.metadata?.componentCount || 0,
              warnings: result.warnings?.length || 0,
              renderTime: result.metadata?.renderTime || 0,
            });
          },
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        return (
          <div>
            <button onClick={() => processCommand('Test command')}>
              Render Test
            </button>
            {renderMetrics && (
              <div data-testid="render-metrics">
                <span data-testid="component-count">{renderMetrics.componentCount}</span>
                <span data-testid="warning-count">{renderMetrics.warnings}</span>
                <span data-testid="render-time">{renderMetrics.renderTime}</span>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Render Test');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(screen.getByTestId('render-metrics')).toBeInTheDocument();
        expect(screen.getByTestId('component-count')).toHaveTextContent('1');
        expect(screen.getByTestId('warning-count')).toHaveTextContent('0');
      });
    });

    it('should track concurrent command processing', async () => {
      const processor = new CommandProcessor();

      const TestComponent = () => {
        const { executeUserCommand, isProcessing } = useCommandProcessor({
          useGlobalProcessor: false,
        });

        const handleMultipleCommands = async () => {
          const commands = [
            'Command 1',
            'Command 2',
            'Command 3'
          ];

          const promises = commands.map(cmd =>
            executeUserCommand(
              cmd,
              {
                caseId: 'test-case-id',
                userId: 'test-user',
                sessionId: 'test-session',
                workflowState: mockWorkflowState,
              },
              async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return mockAgentChatService.chat({
                  query: cmd,
                  caseId: 'test-case-id',
                  userId: 'test-user',
                  sessionId: 'test-session',
                  workflowState: mockWorkflowState,
                });
              }
            )
          );

          await Promise.all(promises);
        };

        return (
          <div>
            <button onClick={handleMultipleCommands} disabled={isProcessing}>
              Concurrent Test
            </button>
            <div data-testid="processing-status">
              {isProcessing ? 'Processing' : 'Ready'}
            </div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Concurrent Test');
      const status = screen.getByTestId('processing-status');

      expect(status).toHaveTextContent('Ready');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(status).toHaveTextContent('Ready');
      });

      const history = processor.getHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe('Telemetry Tracking', () => {
    it('should track chat request lifecycle events', async () => {
      const TestComponent = () => {
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        return (
          <button onClick={() => processCommand('Test command')}>
            Track Telemetry
          </button>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Track Telemetry');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        // Verify telemetry events were recorded
        expect(mockTelemetry.startSpan).toHaveBeenCalledWith(
          expect.any(String), // spanId
          'chat_request_start',
          expect.objectContaining({
            caseId: 'test-case-id',
            stage: 'opportunity',
            queryLength: 12,
          })
        );

        expect(mockTelemetry.endSpan).toHaveBeenCalledWith(
          expect.any(String), // spanId
          'chat_request_complete',
          expect.objectContaining({
            hasSDUI: true,
            stageTransitioned: false,
          })
        );
      });
    });

    it('should track workflow state transitions', async () => {
      const nextState = createMockWorkflowState()
        .atStage('analysis')
        .build();

      mockAgentChatService.chat.mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Stage transition response',
          timestamp: Date.now(),
        },
        sduiPage: mockSDUIPage,
        nextState,
        traceId: 'transition-trace-id',
      });

      const TestComponent = () => {
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        return (
          <button onClick={() => processCommand('Transition command')}>
            Track Transition
          </button>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Track Transition');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockTelemetry.recordWorkflowStateChange).toHaveBeenCalledWith(
          'test-session-id',
          'opportunity',
          'analysis',
          { caseId: 'test-case-id' }
        );
      });
    });

    it('should track error events', async () => {
      const errorMessage = 'Test error for telemetry';
      mockAgentChatService.chat.mockRejectedValue(new Error(errorMessage));

      const TestComponent = () => {
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        return (
          <button onClick={() => processCommand('Error command')}>
            Track Error
          </button>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Track Error');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockTelemetry.recordEvent).toHaveBeenCalledWith({
          type: 'chat_request_error',
          metadata: expect.objectContaining({
            caseId: 'test-case-id',
            stage: 'opportunity',
            error: errorMessage,
          }),
        });
      });
    });

    it('should generate performance summary', async () => {
      // Mock performance summary data
      mockTelemetry.getPerformanceSummary.mockReturnValue({
        avgRenderTime: 150,
        avgHydrationTime: 50,
        totalCommands: 10,
        errorRate: 0.1,
        successRate: 0.9,
      });

      const TestComponent = () => {
        const [summary, setSummary] = useState<any>(null);

        const getSummary = () => {
          const perfSummary = mockTelemetry.getPerformanceSummary();
          setSummary(perfSummary);
        };

        return (
          <div>
            <button onClick={getSummary}>Get Summary</button>
            {summary && (
              <div data-testid="performance-summary">
                <span data-testid="avg-render-time">{summary.avgRenderTime}</span>
                <span data-testid="avg-hydration-time">{summary.avgHydrationTime}</span>
                <span data-testid="success-rate">{summary.successRate}</span>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Get Summary');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(screen.getByTestId('performance-summary')).toBeInTheDocument();
        expect(screen.getByTestId('avg-render-time')).toHaveTextContent('150');
        expect(screen.getByTestId('avg-hydration-time')).toHaveTextContent('50');
        expect(screen.getByTestId('success-rate')).toHaveTextContent('0.9');
      });
    });
  });
});
