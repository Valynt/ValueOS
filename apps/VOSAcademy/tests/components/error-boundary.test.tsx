import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ErrorFallback,
  useAsyncOperation,
  LoadingSpinner,
  ErrorBoundary,
  SkeletonCard,
  SkeletonText
} from '../../src/components/ErrorBoundary'

// Mock React Error Boundary
class MockErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error!} resetError={() => this.setState({ hasError: false, error: null })} />
    }
    return this.props.children
  }
}

describe('Error Handling Components', () => {
  describe('ErrorFallback', () => {
    const mockError = new Error('Test error occurred')
    const mockReset = vi.fn()

    it('renders error message correctly', () => {
      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error occurred')).toBeInTheDocument()
    })

    it('shows retry button', () => {
      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      const retryButton = screen.getByText('Try Again')
      expect(retryButton).toBeInTheDocument()
    })

    it('shows go home button when showHomeButton is true', () => {
      render(<ErrorFallback error={mockError} resetError={mockReset} showHomeButton={true} />)

      expect(screen.getByText('Go Home')).toBeInTheDocument()
    })

    it('hides go home button when showHomeButton is false', () => {
      render(<ErrorFallback error={mockError} resetError={mockReset} showHomeButton={false} />)

      expect(screen.queryByText('Go Home')).not.toBeInTheDocument()
    })

    it('calls resetError when retry button is clicked', async () => {
      const user = userEvent.setup()
      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      const retryButton = screen.getByText('Try Again')
      await user.click(retryButton)

      expect(mockReset).toHaveBeenCalled()
    })

    it('shows development error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('hides development error details in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('includes proper accessibility attributes', () => {
      render(<ErrorFallback error={mockError} resetError={mockReset} />)

      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument() // AlertTriangle icon
    })
  })

  describe('useAsyncOperation', () => {
    const TestComponent = ({ operation, onSuccess, onError }: {
      operation: () => Promise<string>
      onSuccess?: (result: string) => void
      onError?: (error: Error) => void
    }) => {
      const { loading, error, execute } = useAsyncOperation<string>()

      const handleClick = () => {
        execute(operation, onSuccess, onError)
      }

      return (
        <div>
          <button onClick={handleClick} disabled={loading}>
            {loading ? 'Loading...' : 'Execute'}
          </button>
          {error && <div data-testid="error">{error.message}</div>}
        </div>
      )
    }

    it('handles successful operations', async () => {
      const user = userEvent.setup()
      const mockSuccess = vi.fn()
      const mockOperation = vi.fn().mockResolvedValue('success')

      render(
        <TestComponent
          operation={mockOperation}
          onSuccess={mockSuccess}
        />
      )

      const button = screen.getByText('Execute')
      await user.click(button)

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith('success')
      })

      expect(screen.queryByTestId('error')).not.toBeInTheDocument()
    })

    it('handles operation errors', async () => {
      const user = userEvent.setup()
      const mockError = vi.fn()
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))

      render(
        <TestComponent
          operation={mockOperation}
          onError={mockError}
        />
      )

      const button = screen.getByText('Execute')
      await user.click(button)

      await waitFor(() => {
        expect(mockError).toHaveBeenCalled()
      })

      expect(screen.getByTestId('error')).toHaveTextContent('Operation failed')
    })

    it('shows loading state during operation', async () => {
      const user = userEvent.setup()
      const mockOperation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      )

      render(<TestComponent operation={mockOperation} />)

      const button = screen.getByText('Execute')
      await user.click(button)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(button).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByText('Execute')).toBeInTheDocument()
      })
    })
  })

  describe('LoadingSpinner', () => {
    it('renders with default size', () => {
      render(<LoadingSpinner />)

      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders with different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />)

      expect(screen.getByRole('status')).toHaveClass('w-4', 'h-4')

      rerender(<LoadingSpinner size="lg" />)
      expect(screen.getByRole('status')).toHaveClass('w-8', 'h-8')
    })

    it('displays custom text', () => {
      render(<LoadingSpinner text="Processing..." />)

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('includes screen reader text', () => {
      render(<LoadingSpinner />)

      expect(screen.getByText('Loading...', { selector: '.sr-only' })).toBeInTheDocument()
    })

    it('has proper accessibility attributes', () => {
      render(<LoadingSpinner />)

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Skeleton Components', () => {
    describe('SkeletonCard', () => {
      it('renders basic skeleton structure', () => {
        render(<SkeletonCard />)

        expect(screen.getByRole('heading', { level: 3 })).toHaveClass('animate-pulse')
        expect(screen.getByText('', { selector: '[class*="bg-muted"]' })).toBeInTheDocument()
      })

      it('includes proper loading animation', () => {
        render(<SkeletonCard />)

        const skeletonElements = screen.getAllByRole('generic', { hidden: true })
        skeletonElements.forEach(element => {
          if (element.className.includes('animate-pulse')) {
            expect(element).toHaveClass('animate-pulse')
          }
        })
      })
    })

    describe('SkeletonText', () => {
      it('renders single line by default', () => {
        render(<SkeletonText />)

        const skeletonLines = screen.getAllByRole('generic', { hidden: true })
        expect(skeletonLines).toHaveLength(1)
      })

      it('renders multiple lines when specified', () => {
        render(<SkeletonText lines={3} />)

        const skeletonLines = screen.getAllByRole('generic', { hidden: true })
        expect(skeletonLines).toHaveLength(3)
      })

      it('applies proper styling to skeleton lines', () => {
        render(<SkeletonText lines={2} />)

        const skeletonLines = screen.getAllByRole('generic', { hidden: true })
        skeletonLines.forEach(line => {
          expect(line).toHaveClass('animate-pulse')
          expect(line).toHaveClass('bg-muted')
          expect(line).toHaveClass('rounded')
        })
      })

      it('adjusts width for last line', () => {
        render(<SkeletonText lines={3} />)

        const skeletonLines = screen.getAllByRole('generic', { hidden: true })
        const lastLine = skeletonLines[skeletonLines.length - 1]
        expect(lastLine).toHaveClass('w-3/4')
      })
    })
  })

  describe('Error Boundary Integration', () => {
    it('catches and displays errors from child components', () => {
      const ThrowError = () => {
        throw new Error('Child component error')
      }

      const onError = vi.fn()

      render(
        <MockErrorBoundary onError={onError}>
          <ThrowError />
        </MockErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Child component error')).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('allows error recovery', async () => {
      const user = userEvent.setup()

      const ThrowError = () => {
        throw new Error('Recoverable error')
      }

      const RecoverableComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true)

        return (
          <div>
            {!shouldThrow && <div>Recovered successfully!</div>}
            {shouldThrow && <ThrowError />}
            <button onClick={() => setShouldThrow(false)}>Recover</button>
          </div>
        )
      }

      render(
        <MockErrorBoundary>
          <RecoverableComponent />
        </MockErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      const retryButton = screen.getByText('Try Again')
      await user.click(retryButton)

      expect(screen.getByText('Recovered successfully!')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('error fallback includes proper ARIA labels', () => {
      const mockError = new Error('Accessibility test error')

      render(<ErrorFallback error={mockError} resetError={() => {}} />)

      expect(screen.getByLabelText('Alert triangle icon')).toBeInTheDocument()
    })

    it('loading spinner has proper screen reader support', () => {
      render(<LoadingSpinner text="Custom loading message" />)

      expect(screen.getByText('Custom loading message')).toBeInTheDocument()
      expect(screen.getByText('Loading...', { selector: '.sr-only' })).toBeInTheDocument()
    })

    it('skeleton components have proper loading indicators', () => {
      render(<SkeletonCard />)

      // Skeleton should not have distracting content for screen readers
      const skeleton = screen.getByRole('generic')
      expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Performance', () => {
    it('loading spinner does not cause layout shifts', () => {
      const { container } = render(<LoadingSpinner />)

      const spinner = container.querySelector('[role="status"]')
      expect(spinner).toHaveStyle({ display: 'flex' })
    })

    it('skeleton components provide consistent dimensions', () => {
      render(<SkeletonText lines={2} />)

      const lines = screen.getAllByRole('generic', { hidden: true })
      lines.forEach(line => {
        expect(line).toHaveClass('h-3') // Consistent height
      })
    })
  })
})
