/**
 * ErrorBoundary Component Tests
 * Tests for production-grade error handling in SDUI components
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import React from 'react';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws during render
const RenderError = () => {
  throw new Error('Render error');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Error Catching', () => {
    it('should catch errors from child components', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should catch render errors', () => {
      render(
        <ErrorBoundary>
          <RenderError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Fallback UI', () => {
    it('should display error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should display custom fallback when provided', () => {
      const CustomFallback = () => <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should show retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should reset error state on retry', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.click();

      // After retry, if component doesn't throw, it should render normally
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Logging', () => {
    it('should call onError callback when provided', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    it('should include error details in callback', () => {
      const onError = vi.fn();
      const testError = new Error('Specific test error');

      const ThrowSpecificError = () => {
        throw testError;
      };

      render(
        <ErrorBoundary onError={onError}>
          <ThrowSpecificError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        testError,
        expect.any(Object)
      );
    });
  });

  describe('Component Isolation', () => {
    it('should not affect sibling components', () => {
      const Sibling = () => <div>Sibling component</div>;

      render(
        <div>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
          <Sibling />
        </div>
      );

      expect(screen.getByText('Sibling component')).toBeInTheDocument();
    });

    it('should isolate errors to boundary scope', () => {
      render(
        <div>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
          <ErrorBoundary>
            <div>Working component</div>
          </ErrorBoundary>
        </div>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText('Working component')).toBeInTheDocument();
    });
  });

  describe('Nested Error Boundaries', () => {
    it('should catch errors at nearest boundary', () => {
      const OuterFallback = () => <div>Outer error</div>;
      const InnerFallback = () => <div>Inner error</div>;

      render(
        <ErrorBoundary fallback={<OuterFallback />}>
          <ErrorBoundary fallback={<InnerFallback />}>
            <ThrowError />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      expect(screen.getByText('Inner error')).toBeInTheDocument();
      expect(screen.queryByText('Outer error')).not.toBeInTheDocument();
    });

    it('should propagate to outer boundary if inner fails', () => {
      const OuterFallback = () => <div>Outer caught it</div>;
      const FailingFallback = () => {
        throw new Error('Fallback error');
      };

      render(
        <ErrorBoundary fallback={<OuterFallback />}>
          <ErrorBoundary fallback={<FailingFallback />}>
            <ThrowError />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      expect(screen.getByText('Outer caught it')).toBeInTheDocument();
    });
  });

  describe('Error Information', () => {
    it('should display error message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // In development, error details might be shown
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide sensitive error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const SensitiveError = () => {
        throw new Error('Database connection failed: password=secret123');
      };

      render(
        <ErrorBoundary>
          <SensitiveError />
        </ErrorBoundary>
      );

      // Should not display sensitive information
      expect(screen.queryByText(/password=secret123/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Accessibility', () => {
    it('should have accessible error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const errorMessage = screen.getByText(/something went wrong/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toBeVisible();
    });

    it('should have accessible retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toBeEnabled();
    });

    it('should support keyboard navigation', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.focus();
      expect(retryButton).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      
      const TrackedComponent = () => {
        renderSpy();
        return <div>Tracked</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <TrackedComponent />
        </ErrorBoundary>
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Rerender with same props
      rerender(
        <ErrorBoundary>
          <TrackedComponent />
        </ErrorBoundary>
      );

      // Should not cause additional renders
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null children', () => {
      render(
        <ErrorBoundary>
          {null}
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should handle undefined children', () => {
      render(
        <ErrorBoundary>
          {undefined}
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('should handle async errors', async () => {
      const AsyncError = () => {
        React.useEffect(() => {
          throw new Error('Async error');
        }, []);
        return <div>Async component</div>;
      };

      render(
        <ErrorBoundary>
          <AsyncError />
        </ErrorBoundary>
      );

      // Error boundaries don't catch async errors by default
      // This test documents the limitation
      expect(screen.getByText('Async component')).toBeInTheDocument();
    });
  });

  describe('Integration with SDUI', () => {
    it('should work with SDUI components', () => {
      const SDUIComponent = () => (
        <div data-sdui-component="test">SDUI Content</div>
      );

      render(
        <ErrorBoundary>
          <SDUIComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('SDUI Content')).toBeInTheDocument();
    });

    it('should catch SDUI rendering errors', () => {
      const FailingSDUI = () => {
        throw new Error('SDUI render failed');
      };

      render(
        <ErrorBoundary>
          <FailingSDUI />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
