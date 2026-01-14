/**
 * Test Error Boundary Component
 *
 * A specialized error boundary for testing purposes that provides
 * detailed error information and recovery mechanisms for test scenarios.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface TestErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  testName?: string;
}

interface TestErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Error boundary component designed specifically for testing environments.
 * Provides detailed error reporting and recovery mechanisms.
 */
export class TestErrorBoundary extends Component<TestErrorBoundaryProps, TestErrorBoundaryState> {
  constructor(props: TestErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TestErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorCount: (prevState: TestErrorBoundaryState) => prevState.errorCount + 1,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    console.error(`TestErrorBoundary (${this.props.testName || 'Unknown'}):`, error);
    console.error('Error Info:', errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div data-testid="error-boundary" role="alert" aria-live="assertive">
          <h2 data-testid="error-title">Test Error Boundary Triggered</h2>
          <div data-testid="error-details">
            <p data-testid="error-message">{this.state.error?.message}</p>
            <p data-testid="error-count">Error count: {this.state.errorCount}</p>
            {this.props.testName && (
              <p data-testid="test-name">Test: {this.props.testName}</p>
            )}
          </div>
          <details data-testid="error-stack">
            <summary>Error Stack</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
          <details data-testid="error-info">
            <summary>Component Stack</summary>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button
            data-testid="error-reset-button"
            onClick={this.handleReset}
            type="button"
          >
            Reset Error Boundary
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for testing error boundary behavior
 */
export interface UseErrorBoundaryTestResult {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  hasError: boolean;
  triggerError: (error?: Error) => void;
  resetError: () => void;
}

export const useErrorBoundaryTest = (): UseErrorBoundaryTestResult => {
  const [errorState, setErrorState] = React.useState({
    error: null as Error | null,
    errorInfo: null as ErrorInfo | null,
    errorCount: 0,
    hasError: false,
  });

  const triggerError = React.useCallback((error?: Error) => {
    const testError = error || new Error('Test error triggered');
    const errorInfo: ErrorInfo = {
      componentStack: 'Test component stack',
    };

    setErrorState(prev => ({
      error: testError,
      errorInfo,
      errorCount: prev.errorCount + 1,
      hasError: true,
    }));
  }, []);

  const resetError = React.useCallback(() => {
    setErrorState({
      error: null,
      errorInfo: null,
      errorCount: 0,
      hasError: false,
    });
  }, []);

  return {
    ...errorState,
    triggerError,
    resetError,
  };
};

/**
 * Higher-order component for testing error boundaries
 */
export const withTestErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    testName?: string;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  } = {}
) => {
  const WrappedComponent = (props: P) => (
    <TestErrorBoundary
      testName={options.testName}
      fallback={options.fallback}
      onError={options.onError}
    >
      <Component {...props} />
    </TestErrorBoundary>
  );

  WrappedComponent.displayName = `withTestErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Test utilities for error boundary testing
 */
export const errorBoundaryTestUtils = {
  /**
   * Creates a mock error for testing
   */
  createMockError: (message: string = 'Test error', stack?: string) => {
    const error = new Error(message);
    if (stack) {
      error.stack = stack;
    }
    return error;
  },

  /**
   * Creates mock error info for testing
   */
  createMockErrorInfo: (componentStack: string = 'TestComponent\n  at TestComponent') => {
    return {
      componentStack,
    } as ErrorInfo;
  },

  /**
   * Asserts that error boundary caught an error
   */
  assertErrorCaught: (container: HTMLElement, expectedMessage?: string) => {
    const errorBoundary = container.querySelector('[data-testid="error-boundary"]');
    if (!errorBoundary) {
      throw new Error('Error boundary not found in container');
    }

    if (expectedMessage) {
      const errorMessage = container.querySelector('[data-testid="error-message"]');
      if (!errorMessage?.textContent?.includes(expectedMessage)) {
        throw new Error(`Expected error message "${expectedMessage}" not found`);
      }
    }
  },

  /**
   * Asserts that error boundary reset button is present
   */
  assertResetButtonPresent: (container: HTMLElement) => {
    const resetButton = container.querySelector('[data-testid="error-reset-button"]');
    if (!resetButton) {
      throw new Error('Error boundary reset button not found');
    }
  },

  /**
   * Triggers error boundary reset
   */
  resetErrorBoundary: (container: HTMLElement) => {
    const resetButton = container.querySelector('[data-testid="error-reset-button"]') as HTMLButtonElement;
    if (resetButton) {
      resetButton.click();
    } else {
      throw new Error('Error boundary reset button not found');
    }
  },
};

export default TestErrorBoundary;
