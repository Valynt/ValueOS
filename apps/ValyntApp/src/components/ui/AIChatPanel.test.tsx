import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatPanel } from './AIChatPanel';
import type { ChatMessage } from './AIChatPanel';

describe('AIChatPanel', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'assistant',
      content: 'Hello, how can I help?',
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'user',
      content: 'What is the revenue forecast?',
      timestamp: new Date(),
    },
  ];

  it('renders messages correctly', () => {
    render(
      <AIChatPanel
        messages={mockMessages}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
      />
    );

    expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
    expect(screen.getByText('What is the revenue forecast?')).toBeInTheDocument();
  });

  it('displays assistant name and status', () => {
    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        isOnline={true}
      />
    );

    expect(screen.getByText('Vizit AI')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows offline status', () => {
    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        isOnline={false}
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('calls onSendMessage when send button clicked', async () => {
    const handleSend = vi.fn();
    const user = userEvent.setup();

    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={handleSend}
        onInputChange={vi.fn()}
        inputValue="Test message"
      />
    );

    const sendButton = screen.getByLabelText('Send message');
    await user.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith('Test message');
  });

  it('calls onSendMessage on Enter key', async () => {
    const handleSend = vi.fn();
    const user = userEvent.setup();

    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={handleSend}
        onInputChange={vi.fn()}
        inputValue="Test message"
      />
    );

    const input = screen.getByPlaceholderText('Ask Vizit AI...');
    await user.type(input, '{Enter}');

    expect(handleSend).toHaveBeenCalledWith('Test message');
  });

  it('calls onInputChange when typing', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText('Ask Vizit AI...');
    await user.type(input, 'Hello');

    expect(handleChange).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        onClose={handleClose}
      />
    );

    const closeButton = screen.getByLabelText('Close panel');
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });

  it('disables input when loading', () => {
    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        isLoading={true}
      />
    );

    const input = screen.getByPlaceholderText('Ask Vizit AI...');
    expect(input).toBeDisabled();
  });

  it('shows loading indicator', () => {
    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText('Vizit is thinking...')).toBeInTheDocument();
  });

  it('renders quick actions when provided', async () => {
    const handleAction = vi.fn();
    const user = userEvent.setup();

    render(
      <AIChatPanel
        messages={[]}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
        quickActions={[
          { label: 'History', icon: 'history', action: handleAction },
        ]}
      />
    );

    const historyButton = screen.getByLabelText('History');
    await user.click(historyButton);

    expect(handleAction).toHaveBeenCalled();
  });

  it('displays agent metadata in assistant messages', () => {
    const messagesWithMetadata: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Analysis complete',
        timestamp: new Date(),
        metadata: {
          agentId: 'value-analyst',
          confidence: 0.95,
        },
      },
    ];

    render(
      <AIChatPanel
        messages={messagesWithMetadata}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
      />
    );

    expect(screen.getByText('value-analyst')).toBeInTheDocument();
  });

  it('renders suggested actions when provided', () => {
    const messagesWithActions: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Here are some options',
        timestamp: new Date(),
        metadata: {
          actions: [
            { label: 'View Report', action: 'view' },
            { label: 'Export', action: 'export' },
          ],
        },
      },
    ];

    render(
      <AIChatPanel
        messages={messagesWithActions}
        onSendMessage={vi.fn()}
        onInputChange={vi.fn()}
      />
    );

    expect(screen.getByText('View Report')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
