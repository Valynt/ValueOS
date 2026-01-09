
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentErrorBoundary } from '../AgentErrorBoundary';
import { AgentType } from '../../../services/AgentAPI';
import { logger } from '../../../lib/logger';
import { captureException } from '../../../lib/sentry';

// Mock dependencies
vi.mock('../../../services/AgentAPI', () => ({
  AgentType: {
    ValueStrategy: 'ValueStrategy',
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../../../lib/sentry', () => ({
  captureException: vi.fn(),
}));

// Component that throws an error
const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

describe('AgentErrorBoundary', () => {
  const consoleError = console.error;

  beforeEach(() => {
    // Suppress console.error for expected errors
    console.error = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.error = consoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <AgentErrorBoundary>
        <div>Content</div>
      </AgentErrorBoundary>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders error fallback when error occurs', () => {
    render(
      <AgentErrorBoundary>
        <ThrowError />
      </AgentErrorBoundary>
    );
    expect(screen.getByText(/An error occurred while generating agent content/i)).toBeInTheDocument();
  });

  it('renders custom agent error message', () => {
    // Cast to AgentType since we mocked it
    const agent = 'ValueStrategy' as AgentType;
    render(
      <AgentErrorBoundary agent={agent}>
        <ThrowError />
      </AgentErrorBoundary>
    );
    expect(screen.getByText(/The ValueStrategy agent encountered an error/i)).toBeInTheDocument();
  });

  it('calls onError prop when error occurs', () => {
    const onError = vi.fn();
    render(
      <AgentErrorBoundary onError={onError}>
        <ThrowError />
      </AgentErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
    const [error, errorInfo] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(errorInfo).toHaveProperty('componentStack');
  });

  it('logs error to logger', () => {
    render(
      <AgentErrorBoundary>
        <ThrowError />
      </AgentErrorBoundary>
    );
    expect(logger.error).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in agent-driven content'),
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('integrates with Sentry (captureException)', () => {
    // Mock NODE_ENV to production to trigger Sentry logging if checking process.env
    // However, the current implementation checks process.env.NODE_ENV inside componentDidCatch
    // We can't easily change process.env in Vitest for just this test block if it's already loaded?
    // Actually we can with vi.stubEnv if using latest Vitest, or assigning to process.env.

    // Note: The plan is to remove the process.env check and rely on captureException's internal check
    // or just call captureException.
    // If I haven't modified the code yet, this test will fail if NODE_ENV != production.

    // Let's assume we want to verify it calls captureException.
    // For now, I will modify the component first, or I will write the test anticipating the change.

    // If I mock process.env.NODE_ENV = 'production' it might work for the current code too.
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      render(
        <AgentErrorBoundary>
          <ThrowError />
        </AgentErrorBoundary>
      );

      // Based on my plan, I will replace the TODO with captureException call.
      // So I expect captureException to be called.
      expect(captureException).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
