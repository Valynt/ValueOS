import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveLayoutErrorBoundary } from './ExecutiveLayoutErrorBoundary';
import { Component, type ReactNode } from 'react';

// Component that throws an error
class ErrorThrower extends Component<{ message?: string }> {
  override render(): ReactNode {
    throw new Error(this.props.message || 'Test error');
  }
}

const WorkingComponent = () => <div data-testid="working">Normal content</div>;

describe('ExecutiveLayoutErrorBoundary', () => {
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

    render(
      <ExecutiveLayoutErrorBoundary boundaryName="NavPanel">
        <ErrorThrower />
      </ExecutiveLayoutErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NavPanel]'),
      expect.any(Error),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('retry button calls resetErrorBoundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    let renderCount = 0;

    const CounterComponent = () => {
      renderCount++;
      if (renderCount === 1) {
        throw new Error('First render fails');
      }
      return <div data-testid="success">Working now</div>;
    };

    render(
      <ExecutiveLayoutErrorBoundary boundaryName="test">
        <CounterComponent />
      </ExecutiveLayoutErrorBoundary>
    );

    // Error UI shown
    expect(screen.getByText('Retry')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('applies custom className to error UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
