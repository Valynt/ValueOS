import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { vi } from "vitest";

import { AgentReasoningViewer } from '../AgentReasoningViewer';

vi.mock('../../services/AuditTrailService', () => ({
  auditTrailService: {
    queryReasoningChains: vi.fn().mockResolvedValue([
      {
        id: 'chain-test',
        agentId: 'agent-target-1',
        agentName: 'Target',
        agentRole: 'TargetAgent',
        sessionId: 'sess-test',
        rootThought: 'Root thought',
        status: 'completed',
        startTime: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'reasoning', content: 'Thought 1', timestamp: new Date().toISOString(), confidence: 0.8 },
        ],
      },
    ]),
  },
}));

vi.mock('../api/client/unified-api-client', () => ({
  api: {
    executeAgent: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('AgentReasoningViewer', () => {
  it('renders chains and shows confidence', async () => {
    render(<AgentReasoningViewer />);
    await waitFor(() => expect(screen.getByText(/Agent Reasoning Viewer/i)).toBeInTheDocument());
    expect(await screen.findByText(/Root thought/i)).toBeInTheDocument();
    expect(await screen.findByText(/Target/i)).toBeInTheDocument();
  });

  it('merges realtime reasoning updates from WebSocket', async () => {
    const { webSocketManager } = await import('../../services/WebSocketManager');

    render(<AgentReasoningViewer />);
    await waitFor(() => expect(screen.getByText(/Agent Reasoning Viewer/i)).toBeInTheDocument());

    // Emit an agent.reasoning.update message
    const newChain = {
      id: 'chain-rt-1',
      agentId: 'agent-target-rt',
      agentName: 'TargetRT',
      agentRole: 'TargetAgent',
      sessionId: 'sess-rt-1',
      startTime: new Date().toISOString(),
      nodes: [{ id: 'nr1', type: 'reasoning', content: 'Realtime Thought', timestamp: new Date().toISOString(), confidence: 0.77 }],
    };

    webSocketManager.emit('message', {
      type: 'agent.event',
      payload: { eventType: 'agent.reasoning.update', data: newChain },
      timestamp: Date.now(),
      messageId: 'm1',
    });

    expect(await screen.findByText(/Realtime Thought/i)).toBeInTheDocument();
  });

  it('handles integrity.issue.resolved messages without error', async () => {
    const { webSocketManager } = await import('../../services/WebSocketManager');

    render(<AgentReasoningViewer />);
    await waitFor(() => expect(screen.getByText(/Agent Reasoning Viewer/i)).toBeInTheDocument());

    // Emit resolved message - ensure it doesn't crash
    webSocketManager.emit('message', {
      type: 'agent.event',
      payload: { eventType: 'integrity.issue.resolved', data: { issueId: 'issue-abc' } },
      timestamp: Date.now(),
      messageId: 'm2',
    });

    // Component should still be mounted and responsive
    expect(screen.getByText(/Agent Reasoning Viewer/i)).toBeInTheDocument();
  });
});
