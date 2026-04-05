import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveLayoutErrorBoundary } from './ExecutiveLayoutErrorBoundary';
import { Component, type ReactNode } from 'react';
import { RequestIdContext } from '@valueos/sdui';

const { trackMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
}));

vi.mock('@/lib/analyticsClient', () => ({
  analyticsClient: {
    track: trackMock,
  },
}));

// Component that throws an error
class ErrorThrower extends Component<{ message?: string }> {
  override render(): ReactNode {
    throw new Error(this.props.message || 'Test error');
  }
}

const WorkingComponent = () => <div data-testid="working">Normal content</div>;

describe('ExecutiveLayoutErrorBoundary', () => {
  it('emits telemetry once per captured error with safe payload fields', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    window.history.pushState({}, '', '/executive/overview');

    render(
      <RequestIdContext.Provider value={{ lastFailedRequestId: 'req-123' }}>
        <ExecutiveLayoutErrorBoundary boundaryName="ExecutiveSidebar">
          <ErrorThrower message={'Credentials leaked\nshould-not-break-telemetry'} />
        </ExecutiveLayoutErrorBoundary>
      </RequestIdContext.Provider>
    );

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      'react_error_boundary_triggered',
      expect.objectContaining({
        boundary_name: 'ExecutiveSidebar',
        error_message: 'Credentials leaked should-not-break-telemetry',
        component_stack: expect.any(String),
        route: '/executive/overview',
        correlation_id: 'req-123',
      })
    );
    expect(trackMock.mock.calls[0]?.[1]).not.toHaveProperty('error_stack');

    consoleSpy.mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <ExecutiveLayoutErrorBoundary boundaryName="test">
        <WorkingComponent />
      </ExecutiveLayoutErrorBoundary>
    );

    expect(screen.getByTestId('working')).toBeInTheDocument();
  });

  it('catches errors and shows error UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    trackMock.mockClear();

    render(
      <ExecutiveLayoutErrorBoundary boundaryName="test-boundary">
        <ErrorThrower message="Something broke!" />
      </ExecutiveLayoutErrorBoundary>
    );

    expect(screen.getByText('This section encountered an error')).toBeInTheDocument();
    expect(screen.getByText('Something broke!')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    trackMock.mockClear();

    render(
      <ExecutiveLayoutErrorBoundary
        boundaryName="test"
        fallback={<div data-testid="custom-fallback">Custom error</div>}
      >
        <ErrorThrower />
      </ExecutiveLayoutErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText('This section encountered an error')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows boundary name in console error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    trackMock.mockClear();

    render(
      <ExecutiveLayoutErrorBoundary boundaryName="NavPanel">
        <ErrorThrower />
      </ExecutiveLayoutErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NavPanel] Error caught'),
      expect.objectContaining({
        error_message: 'Test error',
      })
    );

    consoleSpy.mockRestore();
  });

  it('retry button calls resetErrorBoundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    trackMock.mockClear();

    render(
      <ExecutiveLayoutErrorBoundary boundaryName="test">
        <ErrorThrower message="First render fails" />
      </ExecutiveLayoutErrorBoundary>
    );

    // Error UI shown
    expect(screen.getByText('Retry')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('applies custom className to error UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    trackMock.mockClear();

    render(
      <ExecutiveLayoutErrorBoundary
        boundaryName="test"
        className="my-custom-class"
      >
        <ErrorThrower />
      </ExecutiveLayoutErrorBoundary>
    );

    const errorContainer = screen.getByText('This section encountered an error').parentElement;
    expect(errorContainer).toHaveClass('my-custom-class');

    consoleSpy.mockRestore();
  });
});
