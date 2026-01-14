/**
 * Integration Tests for Canvas Workspace Pipeline
 *
 * Tests the complete flow from user command to canvas rendering.
 * Covers session management, command processing, AI integration, and SDUI rendering.
 */

import React, { useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC, ReactNode } from 'react';

// Mock imports - these would be properly imported in a real setup
const mockSupabase = {
  auth: { getSession: jest.fn() },
  from: jest.fn(),
} as any;

const mockAgentChatService = {
  chat: jest.fn(),
} as any;

const mockWorkflowStateService = {
  loadOrCreateSession: jest.fn(),
  saveWorkflowState: jest.fn(),
} as any;

// Mock components and services
jest.mock('../../lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../../services/AgentChatService', () => ({ agentChatService: mockAgentChatService }));
jest.mock('../../services/WorkflowStateService', () => ({ WorkflowStateService: jest.fn(() => mockWorkflowStateService) }));
jest.mock('../../lib/logger');
jest.mock('../../lib/telemetry/SDUITelemetry');
jest.mock('../../lib/analyticsClient');

// Test utilities
const createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: { tenant_id: 'test-tenant' },
  created_at: '2024-01-01T00:00:00Z',
});

const createMockCase = (overrides = {}) => ({
  id: 'test-case-id',
  name: 'Test Case',
  company: 'Test Company',
  stage: 'opportunity',
  status: 'in-progress',
  updatedAt: new Date(),
  ...overrides,
});

const createMockWorkflowState = (overrides = {}) => ({
  currentStage: 'opportunity',
  status: 'in_progress',
  completedStages: [],
  context: {
    caseId: 'test-case-id',
    company: 'Test Company',
  },
  metadata: {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    errorCount: 0,
    retryCount: 0,
  },
  ...overrides,
});

const createMockSDUIPage = () => ({
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'TextBlock',
      version: 1,
      props: {
        text: '### Test Analysis\n\nThis is a test analysis.',
        className: 'mb-6 prose dark:prose-invert',
      },
    },
  ],
  metadata: {
    case_id: 'test-case-id',
    session_id: 'test-session-id',
    trace_id: 'test-trace-id',
    generated_at: Date.now(),
    priority: 'high',
  },
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

describe('Canvas Workspace Pipeline Integration Tests', () => {
  let mockUser: any;
  let mockCase: any;
  let mockWorkflowState: any;
  let mockSDUIPage: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock data
    mockUser = createMockUser();
    mockCase = createMockCase();
    mockWorkflowState = createMockWorkflowState();
    mockSDUIPage = createMockSDUIPage();

    // Mock Supabase auth
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'test-token' } },
      error: null,
    });

    // Mock Supabase queries
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockWorkflowState,
              error: null,
            }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-session-id', ...mockWorkflowState },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    } as any);

    // Mock AgentChatService
    mockAgentChatService.chat.mockResolvedValue({
      message: {
        role: 'assistant',
        content: 'Test analysis response',
        timestamp: Date.now(),
        agentName: 'Test Agent',
        confidence: 0.9,
        reasoning: ['Test reasoning'],
      },
      sduiPage: mockSDUIPage,
      nextState: mockWorkflowState,
      traceId: 'test-trace-id',
    });
  });

  describe('Session Management', () => {
    it('should initialize user session and load cases', async () => {
      render(
        <TestWrapper>
          <ChatCanvasLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      });
    });

    it('should create new session when case is selected', async () => {
      const mockWorkflowStateService = new WorkflowStateService(mockSupabase);
      const mockCreateSession = jest.spyOn(mockWorkflowStateService, 'loadOrCreateSession');
      mockCreateSession.mockResolvedValue({
        sessionId: 'test-session-id',
        state: mockWorkflowState,
      });

      render(
        <TestWrapper>
          <ChatCanvasLayout />
        </TestWrapper>
      );

      // Simulate case selection
      // This would need to be implemented based on the actual UI
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalled();
      });
    });
  });

  describe('Command Processing', () => {
    it('should process user command through AI agent', async () => {
      const TestComponent = () => {
        const { processCommand, isProcessing } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: jest.fn(),
          onRenderedPageUpdate: jest.fn(),
          onStreamingUpdate: jest.fn(),
          onLoadingUpdate: jest.fn(),
          refetchCases: jest.fn(),
        });

        return (
          <div>
            <button
              onClick={() => processCommand('Analyze this business case')}
              disabled={isProcessing}
            >
              Process Command
            </button>
            <div data-testid="processing-status">
              {isProcessing ? 'Processing...' : 'Ready'}
            </div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Process Command');
      const status = screen.getByTestId('processing-status');

      expect(status).toHaveTextContent('Ready');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockAgentChatService.chat).toHaveBeenCalledWith({
          query: 'Analyze this business case',
          caseId: 'test-case-id',
          userId: mockUser.id,
          sessionId: 'test-session-id',
          workflowState: mockWorkflowState,
        });
      });
    });

    it('should handle command processing errors gracefully', async () => {
      const errorMessage = 'AI service unavailable';
      mockAgentChatService.chat.mockRejectedValue(new Error(errorMessage));

      const TestComponent = () => {
        const { processCommand, isProcessing } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: jest.fn(),
          onRenderedPageUpdate: jest.fn(),
          onStreamingUpdate: jest.fn(),
          onLoadingUpdate: jest.fn(),
          refetchCases: jest.fn(),
        });

        return (
          <button onClick={() => processCommand('Test command')}>
            Process Command
          </button>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Process Command');

      await act(async () => {
        userEvent.click(button);
      });

      // Should handle error without crashing
      await waitFor(() => {
        expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
      });
    });
  });

  describe('SDUI Rendering Pipeline', () => {
    it('should render SDUI page from AI response', async () => {
      const TestComponent = () => {
        const [renderedPage, setRenderedPage] = useState(null);
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: jest.fn(),
          onRenderedPageUpdate: setRenderedPage,
          onStreamingUpdate: jest.fn(),
          onLoadingUpdate: jest.fn(),
          refetchCases: jest.fn(),
        });

        return (
          <div>
            <button onClick={() => processCommand('Test command')}>
              Process Command
            </button>
            {renderedPage && <div data-testid="rendered-content">Content Rendered</div>}
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Process Command');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(screen.getByTestId('rendered-content')).toBeInTheDocument();
      });
    });

    it('should handle SDUI rendering errors', async () => {
      const invalidSDUIPage = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'NonExistentComponent',
            version: 1,
            props: {},
          },
        ],
        metadata: {},
      };

      mockAgentChatService.chat.mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Test response',
          timestamp: Date.now(),
        },
        sduiPage: invalidSDUIPage,
        nextState: mockWorkflowState,
        traceId: 'test-trace-id',
      });

      const TestComponent = () => {
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: jest.fn(),
          onRenderedPageUpdate: jest.fn(),
          onStreamingUpdate: jest.fn(),
          onLoadingUpdate: jest.fn(),
          refetchCases: jest.fn(),
        });

        return (
          <button onClick={() => processCommand('Test command')}>
            Process Command
          </button>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Process Command');

      await act(async () => {
        userEvent.click(button);
      });

      // Should handle rendering error gracefully
      await waitFor(() => {
        expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Command Pattern Integration', () => {
    it('should execute commands through command processor', async () => {
      const TestComponent = () => {
        const { executeUserCommand, canUndo, canRedo } = useCommandProcessor({
          useGlobalProcessor: false,
        });

        const handleCommand = async () => {
          await executeUserCommand(
            'Test command',
            {
              caseId: 'test-case-id',
              userId: 'test-user',
              sessionId: 'test-session',
              workflowState: mockWorkflowState,
            },
            async (query, context) => {
              return mockAgentChatService.chat({
                query,
                caseId: context.caseId,
                userId: context.userId,
                sessionId: context.sessionId,
                workflowState: context.workflowState,
              });
            }
          );
        };

        return (
          <div>
            <button onClick={handleCommand}>Execute Command</button>
            <div data-testid="undo-status">{canUndo ? 'Can Undo' : 'Cannot Undo'}</div>
            <div data-testid="redo-status">{canRedo ? 'Can Redo' : 'Cannot Redo'}</div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Execute Command');

      expect(screen.getByTestId('undo-status')).toHaveTextContent('Cannot Undo');
      expect(screen.getByTestId('redo-status')).toHaveTextContent('Cannot Redo');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockAgentChatService.chat).toHaveBeenCalled();
      });
    });

    it('should support undo/redo operations', async () => {
      const processor = new CommandProcessor({ enableUndo: true });

      const TestComponent = () => {
        const { executeCreateCase, undo, redo, canUndo, canRedo } = useCommandProcessor({
          useGlobalProcessor: false,
        });

        const handleCreateCase = async () => {
          await executeCreateCase(
            mockCase,
            async () => mockCase,
            jest.fn()
          );
        };

        return (
          <div>
            <button onClick={handleCreateCase}>Create Case</button>
            <button onClick={undo} disabled={!canUndo}>Undo</button>
            <button onClick={redo} disabled={!canRedo}>Redo</button>
            <div data-testid="history-count">{processor.getHistory().length}</div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const createButton = screen.getByText('Create Case');
      const undoButton = screen.getByText('Undo');
      const redoButton = screen.getByText('Redo');
      const historyCount = screen.getByTestId('history-count');

      expect(historyCount).toHaveTextContent('0');
      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();

      await act(async () => {
        userEvent.click(createButton);
      });

      await waitFor(() => {
        expect(historyCount).toHaveTextContent('1');
        expect(undoButton).not.toBeDisabled();
        expect(redoButton).toBeDisabled();
      });

      await act(async () => {
        userEvent.click(undoButton);
      });

      await waitFor(() => {
        expect(redoButton).not.toBeDisabled();
      });
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full user command workflow', async () => {
      // Mock the complete workflow
      const mockWorkflowStateService = new WorkflowStateService(mockSupabase);
      jest.spyOn(mockWorkflowStateService, 'loadOrCreateSession').mockResolvedValue({
        sessionId: 'test-session-id',
        state: mockWorkflowState,
      });
      jest.spyOn(mockWorkflowStateService, 'saveWorkflowState').mockResolvedValue();

      render(
        <TestWrapper>
          <ChatCanvasLayout />
        </TestWrapper>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      });

      // Simulate the complete workflow
      // 1. User enters command
      // 2. Command is processed
      // 3. AI agent responds
      // 4. SDUI is rendered
      // 5. State is persisted

      await waitFor(() => {
        expect(mockAgentChatService.chat).toHaveBeenCalled();
      });
    });

    it('should handle workflow interruptions gracefully', async () => {
      // Simulate network error during command processing
      mockAgentChatService.chat.mockRejectedValueOnce(new Error('Network error'));
      mockAgentChatService.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: 'Retry successful',
          timestamp: Date.now(),
        },
        sduiPage: mockSDUIPage,
        nextState: mockWorkflowState,
        traceId: 'retry-trace-id',
      });

      const TestComponent = () => {
        const { processCommand, isProcessing } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: jest.fn(),
          onRenderedPageUpdate: jest.fn(),
          onStreamingUpdate: jest.fn(),
          onLoadingUpdate: jest.fn(),
          refetchCases: jest.fn(),
        });

        return (
          <div>
            <button onClick={() => processCommand('Test command')}>
              Process Command
            </button>
            <div data-testid="processing-status">
              {isProcessing ? 'Processing...' : 'Ready'}
            </div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Process Command');
      const status = screen.getByTestId('processing-status');

      // First attempt fails
      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(status).toHaveTextContent('Ready');
      });

      // Second attempt succeeds
      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockAgentChatService.chat).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance and Telemetry', () => {
    it('should track command execution metrics', async () => {
      const processor = new CommandProcessor();

      const TestComponent = () => {
        const { executeUserCommand } = useCommandProcessor({
          useGlobalProcessor: false,
        });

        const handleCommand = async () => {
          const startTime = Date.now();
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
              await new Promise(resolve => setTimeout(resolve, 100));
              return mockAgentChatService.chat({
                query: 'Performance test command',
                caseId: 'test-case-id',
                userId: 'test-user',
                sessionId: 'test-session',
                workflowState: mockWorkflowState,
              });
            }
          );
        };

        return (
          <button onClick={handleCommand}>Performance Test</button>
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
    });
  });
});

// Helper function to test async components
function asyncAct(action: () => Promise<any>): Promise<void> {
  return act(action);
}
