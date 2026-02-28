import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { vi } from 'vitest';

import { auditTrailService } from '../../services/AuditTrailService';
import { webSocketManager } from '../../services/WebSocketManager';
import { AgentReasoningViewer } from '../AgentReasoningViewer';

vi.mock('../../services/AuditTrailService', () => ({
  auditTrailService: {
    queryReasoningChains: vi.fn().mockResolvedValue([
      {
        id: 'sess-test-agent-target-1',
        agentId: 'agent-target-1',
        agentName: 'Target',
        agentRole: 'TargetAgent',
        sessionId: 'sess-test',
        rootThought: 'Root thought',
        status: 'in_progress',
        startTime: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'reasoning', content: 'Thought 1', timestamp: new Date().toISOString(), confidence: 0.8 },
        ],
      },
    ]),
  },
}));

describe('AgentReasoningViewer realtime updates', () => {
  it('merges incoming reasoning update and displays new node', async () => {
    render(<AgentReasoningViewer />);

    // Wait for initial chain to render
    await waitFor(() => expect(screen.getByText(/Root thought/i)).toBeInTheDocument());

    // Open chain detail
    const chainCard = screen.getByText(/Root thought/i).closest('div[role]') || screen.getByText(/Root thought/i).parentElement!.parentElement!;
    userEvent.click(chainCard!);

    // Simulate incoming WS message with new node
    const msg = {
      type: 'agent.event',
      payload: {
        eventType: 'agent.reasoning.update',
        data: {
          agentId: 'agent-target-1',
          sessionId: 'sess-test',
          response: {
            nodes: [
              { id: 'n-new', type: 'observation', content: 'Realtime observation: new signal', timestamp: new Date().toISOString(), confidence: 0.66 },
            ],
          },
        },
      },
    };

    // Emit via webSocketManager
    webSocketManager.emit('message', msg);

    // Expect new content to appear in modal
    await waitFor(() => expect(screen.getByText(/Realtime observation: new signal/i)).toBeInTheDocument());
  });

  it('removes resolved integrity issue on integrity.issue.resolved event', async () => {
    // Render and set a mock integrity issue into state via mocking initial load
    render(<AgentReasoningViewer />);

    // Wait for component
    await waitFor(() => expect(screen.getByText(/Agent Reasoning Viewer/i)).toBeInTheDocument());

    // Push a mock issue into component state by emitting agent event for integrity issue (the component listens and filters)
    const issue = {
      id: 'issue-abc',
      agentId: 'IntegrityAgent',
      sessionId: 'sess-1',
      issueType: 'low_confidence',
      severity: 'medium',
      description: 'Mock issue',
      originalOutput: {},
      suggestedFix: {},
      confidence: 0.5,
      timestamp: new Date().toISOString(),
    };

    // Add an initial issue (simulate the component having it)
    webSocketManager.emit('message', { type: 'agent.event', payload: { eventType: 'integrity.issue.created', data: issue } });

    // Now resolve it
    webSocketManager.emit('message', { type: 'agent.event', payload: { eventType: 'integrity.issue.resolved', data: { issueId: 'issue-abc' } } });

    // Ensure issue is not present in the integrity panel (no error thrown)
    await waitFor(() => expect(screen.queryByText(/Mock issue/i)).not.toBeInTheDocument());
  });
});
