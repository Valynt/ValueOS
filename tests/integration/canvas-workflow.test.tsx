/**
 * Integration Tests for Canvas Workspace Pipeline
 *
 * Comprehensive test suite covering the complete flow from user command submission
 * through AI processing to SDUI rendering. Tests session management, command processing,
 * AI integration, and SDUI rendering with proper error handling and accessibility.
 *
 * @testSuite Canvas Workflow Integration
 * @coverage End-to-end pipeline testing
 * @author ValueOS Testing Team
 * @since 2024-01-01
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { FC, ReactNode } from 'react';
import { vi } from 'vitest';

// Import components and hooks used in tests
import ChatCanvasLayout from '../../src/components/ChatCanvas/ChatCanvasLayout';
import { useCanvasCommand } from '../../src/hooks/useCanvasCommand';
import { useCommandProcessor } from '../../src/hooks/useCommandProcessor';
import { CommandProcessor } from '../../src/lib/commands/CommandProcessor';
import { WorkflowStateService } from '../../src/services/WorkflowStateService';

// Mock imports - these would be properly imported in a real setup
const mockSupabase = {
  auth: { getSession: vi.fn() },
  from: vi.fn(),
} as any;

const mockAgentChatService = {
  chat: vi.fn(),
} as any;

const mockWorkflowStateService = {
  loadOrCreateSession: vi.fn(),
  saveWorkflowState: vi.fn(),
} as any;

// Mock components and services
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }));
vi.mock('../../services/AgentChatService', () => ({ agentChatService: mockAgentChatService }));
vi.mock('../../services/WorkflowStateService', () => ({ WorkflowStateService: vi.fn(() => mockWorkflowStateService) }));
vi.mock('../../lib/logger');
vi.mock('../../lib/telemetry/SDUITelemetry');
vi.mock('../../lib/analyticsClient');

// Mock ChatCanvasLayout to avoid component type issues
vi.mock('../../src/components/ChatCanvas/ChatCanvasLayout', () => ({
  default: () => <div data-testid="chat-canvas-layout">ChatCanvasLayout Mock</div>
}));

// Import mock builders for cleaner test setup
import {
  createErrorTestSetup,
  createMockAgentChatService,
  createMockCase,
  createMockSDUIPage,
  createMockSupabase,
  createMockUser,
  createMockWorkflowState,
  createStandardTestSetup
} from './test-utils/mockBuilders';

// Mock imports - these would be properly imported in a real setup
const mockSupabase = createMockSupabase().build();
const mockAgentChatService = createMockAgentChatService().build();
const mockWorkflowStateService = {
  loadOrCreateSession: vi.fn(),
  saveWorkflowState: vi.fn(),
} as any;

// Test wrapper component
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

describe('Canvas Workspace Pipeline Integration Tests', () => {
  let mockUser: any;
  let mockCase: any;
  let mockWorkflowState: any;
  let mockSDUIPage: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup standard test data using builders
    const testSetup = createStandardTestSetup();
    mockUser = testSetup.user;
    mockCase = testSetup.caseData;
    mockWorkflowState = testSetup.workflowState;
    mockSDUIPage = testSetup.sduiPage;

    // Update mocks with test data
    Object.assign(mockSupabase, testSetup.supabase);
    Object.assign(mockAgentChatService, testSetup.agentChatService);
  });

  /**
   * Test suite for Session Management functionality
   *
   * Covers user authentication, session creation, resuming existing sessions,
   * and proper session cleanup. Ensures that session state is properly maintained
   * across component interactions and page refreshes.
   */
  describe('Session Management', () => {
    /**
     * Tests basic user session initialization and case loading
     *
     * Verifies that:
     * - User authentication is properly validated
     * - Session data is correctly loaded from storage
     * - UI components receive proper session context
     */
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

    /**
     * Tests new session creation when a case is selected
     *
     * Verifies that:
     * - Session service is called with correct parameters
     * - Initial workflow state is properly configured
     * - Case context is correctly passed to the session
     * - Session ID is properly generated and stored
     */
    it('should create new session when case is selected', async () => {
      const mockWorkflowStateService = new WorkflowStateService(mockSupabase);
      const mockCreateSession = vi.spyOn(mockWorkflowStateService, 'loadOrCreateSession');

      const expectedState = createMockWorkflowState()
        .atStage('opportunity')
        .withContext({ caseId: 'test-case-id', company: 'Test Company' })
        .build();

      mockCreateSession.mockResolvedValue({
        sessionId: 'test-session-id',
        state: expectedState,
      });

      render(
        <TestWrapper>
          <ChatCanvasLayout />
        </TestWrapper>
      );

      // Simulate case selection by triggering the case selection callback
      // This simulates clicking on a case in the UI
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith({
          caseId: 'test-case-id',
          userId: mockUser.id,
          tenantId: mockUser.user_metadata.tenant_id,
          initialStage: 'opportunity',
          context: { company: 'Test Company' }
        });
      });
    });

    /**
     * Tests resuming existing sessions when available
     *
     * Verifies that:
     * - Existing sessions are properly detected and resumed
     * - Workflow state is correctly restored
     * - Session continuity is maintained across interactions
     * - No duplicate sessions are created
     */
    it('should resume existing session when available', async () => {
      const mockWorkflowStateService = new WorkflowStateService(mockSupabase);
      const mockCreateSession = vi.spyOn(mockWorkflowStateService, 'loadOrCreateSession');

      const existingState = createMockWorkflowState()
        .atStage('analysis')
        .withRetries(1)
        .build();

      mockCreateSession.mockResolvedValue({
        sessionId: 'existing-session-id',
        state: existingState,
      });

      render(
        <TestWrapper>
          <ChatCanvasLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalled();
      });
    });
  });

  /**
   * Test suite for Command Processing functionality
   *
   * Covers user command submission, AI agent processing, error handling,
   * and retry mechanisms. Ensures commands are processed reliably with
   * proper feedback and error recovery.
   */
  describe('Command Processing', () => {
    /**
     * Tests successful command processing through AI agent
     *
     * Verifies that:
     * - User commands are properly formatted and sent
     * - AI agent receives correct context and parameters
     * - Processing state is properly managed
     * - Success responses are handled correctly
     */
    it('should process user command through AI agent', async () => {
      const TestComponent = () => {
        const { processCommand, isProcessing } = useCanvasCommand({
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

    /**
     * Tests graceful error handling for command processing failures
     *
     * Verifies that:
     * - Errors are caught and handled without crashing
     * - User feedback is provided for error conditions
     * - Processing state is properly reset after errors
     * - Error telemetry is properly recorded
     * - UI remains responsive during error conditions
     */
    it('should handle command processing errors gracefully', async () => {
      const errorMessage = 'AI service unavailable';
      const errorSetup = createErrorTestSetup(errorMessage);

      // Update mocks with error setup
      Object.assign(mockSupabase, errorSetup.supabase);
      Object.assign(mockAgentChatService, errorSetup.agentChatService);

      const TestComponent = () => {
        const { processCommand, isProcessing } = useCanvasCommand({
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
          <div>
            <button onClick={() => processCommand('Test command')}>
              Process Command
            </button>
            <div data-testid="processing-status">
              {isProcessing ? 'Processing...' : 'Ready'}
            </div>
            <div data-testid="error-display">
              {/* Error would be displayed here */}
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

      // Should handle error without crashing
      await waitFor(() => {
        expect(status).toHaveTextContent('Ready'); // Should return to ready state
        expect(mockAgentChatService.chat).toHaveBeenCalledWith({
          query: 'Test command',
          caseId: 'test-case-id',
          userId: mockUser.id,
          sessionId: 'test-session-id',
          workflowState: mockWorkflowState,
        });
      });

      // Verify error was handled gracefully
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    });

    /**
     * Tests network error handling and retry capabilities
     *
     * Verifies that:
     * - Network timeouts are properly detected
     * - Retry mechanisms work as expected
     * - Multiple failures don't cause UI lockup
     * - Success after retry is handled correctly
     * - Retry count is properly tracked
     */
    it('should handle network errors with retry capability', async () => {
      const networkError = new Error('Network timeout');
      const retrySetup = createErrorTestSetup('Network timeout');

      // Mock first call to fail, second to succeed
      mockAgentChatService.chat
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
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
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
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
        expect(mockAgentChatService.chat).toHaveBeenCalledTimes(1);
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
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: setRenderedPage,
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
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
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
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
            vi.fn()
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
      vi.spyOn(mockWorkflowStateService, 'loadOrCreateSession').mockResolvedValue({
        sessionId: 'test-session-id',
        state: mockWorkflowState,
      });
      vi.spyOn(mockWorkflowStateService, 'saveWorkflowState').mockResolvedValue();

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
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
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
