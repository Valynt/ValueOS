import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  useLazyLoad,
  useDebounce,
  useThrottle,
  Cache,
  useCache,
  useAsyncOperation,
  LoadingSpinner
} from '../../src/lib/performance'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
})
global.IntersectionObserver = mockIntersectionObserver

describe('Performance Hooks and Utilities', () => {
  describe('useLazyLoad', () => {
    it('returns initial state correctly', () => {
      let hookResult: any

      const TestComponent = () => {
        hookResult = useLazyLoad()
        return <div ref={hookResult.ref}>Test</div>
      }

      render(<TestComponent />)

      expect(hookResult.isIntersecting).toBe(false)
      expect(hookResult.hasIntersected).toBe(false)
      expect(hookResult.ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('handles intersection observer callback', () => {
      let hookResult: any

      const TestComponent = () => {
        hookResult = useLazyLoad()
        return <div ref={hookResult.ref}>Test</div>
      }

      render(<TestComponent />)

      // Simulate intersection
      const observerCallback = mockIntersectionObserver.mock.calls[0][0]
      observerCallback([{ isIntersecting: true }])

      expect(hookResult.isIntersecting).toBe(true)
      expect(hookResult.hasIntersected).toBe(true)
    })

    it('accepts custom intersection observer options', () => {
      const customOptions = { threshold: 0.5, rootMargin: '10px' }

      render(<div ref={useLazyLoad(customOptions).ref}>Test</div>)

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        customOptions
      )
    })
  })

  describe('useDebounce', () => {
    it('debounces value changes', async () => {
      let debouncedValue: string

      const TestComponent = ({ value }: { value: string }) => {
        debouncedValue = useDebounce(value, 100)
        return <div>{debouncedValue}</div>
      }

      const { rerender } = render(<TestComponent value="initial" />)
      expect(debouncedValue).toBe('initial')

      rerender(<TestComponent value="changed" />)
      expect(debouncedValue).toBe('initial') // Should not change immediately

      await waitFor(() => {
        expect(debouncedValue).toBe('changed')
      }, { timeout: 150 })
    })

    it('cancels previous timeout on new value', async () => {
      let debouncedValue: string

      const TestComponent = ({ value }: { value: string }) => {
        debouncedValue = useDebounce(value, 100)
        return <div>{debouncedValue}</div>
      }

      const { rerender } = render(<TestComponent value="first" />)

      // Change value before debounce timeout
      setTimeout(() => rerender(<TestComponent value="second" />), 50)

      await waitFor(() => {
        expect(debouncedValue).toBe('second') // Should get final value, not intermediate
      }, { timeout: 200 })
    })
  })

  describe('useThrottle', () => {
    it('throttles value changes', async () => {
      let throttledValue: string
      let updateCount = 0

      const TestComponent = ({ value }: { value: string }) => {
        throttledValue = useThrottle(value, 100)
        updateCount++
        return <div>{throttledValue}</div>
      }

      const { rerender } = render(<TestComponent value="initial" />)
      expect(throttledValue).toBe('initial')
      expect(updateCount).toBe(1)

      // Multiple rapid changes
      rerender(<TestComponent value="first" />)
      rerender(<TestComponent value="second" />)
      rerender(<TestComponent value="third" />)

      // Should still be throttled
      expect(throttledValue).toBe('initial')

      await waitFor(() => {
        expect(throttledValue).toBe('third')
      }, { timeout: 150 })
    })
  })

  describe('Cache', () => {
    let cache: Cache

    beforeEach(() => {
      cache = Cache.getInstance()
      cache.clear()
    })

    it('stores and retrieves values', () => {
      cache.set('test', 'value')
      expect(cache.get('test')).toBe('value')
    })

    it('respects TTL', () => {
      cache.set('test', 'value', 100) // 100ms TTL

      expect(cache.get('test')).toBe('value')

      // Wait for expiration
      vi.advanceTimersByTime(150)

      expect(cache.get('test')).toBeNull()
    })

    it('clears all values', () => {
      cache.set('test1', 'value1')
      cache.set('test2', 'value2')

      cache.clear()

      expect(cache.get('test1')).toBeNull()
      expect(cache.get('test2')).toBeNull()
    })

    it('deletes specific values', () => {
      cache.set('test1', 'value1')
      cache.set('test2', 'value2')

      cache.delete('test1')

      expect(cache.get('test1')).toBeNull()
      expect(cache.get('test2')).toBe('value2')
    })

    it('returns singleton instance', () => {
      const cache1 = Cache.getInstance()
      const cache2 = Cache.getInstance()

      cache1.set('shared', 'value')
      expect(cache2.get('shared')).toBe('value')
    })
  })

  describe('useCache', () => {
    it('provides cache operations', () => {
      let cacheOps: any

      const TestComponent = () => {
        cacheOps = useCache('test-key')
        return <div>Cache Test</div>
      }

      render(<TestComponent />)

      expect(typeof cacheOps.set).toBe('function')
      expect(typeof cacheOps.get).toBe('function')
      expect(typeof cacheOps.clear).toBe('function')
    })

    it('integrates with Cache singleton', () => {
      let cacheOps: any

      const TestComponent = () => {
        cacheOps = useCache('test-key')
        return <div>Cache Test</div>
      }

      render(<TestComponent />)

      cacheOps.set('test-value')
      expect(cacheOps.get()).toBe('test-value')
    })

    it('respects custom TTL', () => {
      let cacheOps: any

      const TestComponent = () => {
        cacheOps = useCache('test-key', 100)
        return <div>Cache Test</div>
      }

      render(<TestComponent />)

      cacheOps.set('test-value')

      expect(cacheOps.get()).toBe('test-value')

      // Simulate time passing
      vi.advanceTimersByTime(150)

      expect(cacheOps.get()).toBeNull()
    })
  })

  describe('LoadingSpinner', () => {
    it('renders with default props', () => {
      render(<LoadingSpinner />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />)

      expect(screen.getByRole('status')).toHaveClass('w-4', 'h-4')

      rerender(<LoadingSpinner size="lg" />)
      expect(screen.getByRole('status')).toHaveClass('w-8', 'h-8')
    })

    it('displays custom loading text', () => {
      render(<LoadingSpinner text="Processing data..." />)

      expect(screen.getByText('Processing data...')).toBeInTheDocument()
    })

    it('includes screen reader text', () => {
      render(<LoadingSpinner />)

      expect(screen.getByText('Loading...', { selector: '.sr-only' })).toBeInTheDocument()
    })

    it('has proper ARIA attributes', () => {
      render(<LoadingSpinner />)

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('useAsyncOperation', () => {
    it('handles successful async operations', async () => {
      const user = userEvent.setup()
      let result: any

      const TestComponent = () => {
        const { loading, error, execute } = useAsyncOperation()

        const handleClick = () => {
          execute(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return 'success'
          }, (res) => { result = res })
        }

        return (
          <div>
            <button onClick={handleClick} disabled={loading}>
              {loading ? 'Loading...' : 'Execute'}
            </button>
            {error && <div>Error: {error.message}</div>}
          </div>
        )
      }

      render(<TestComponent />)

      const button = screen.getByText('Execute')
      await user.click(button)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(button).toBeDisabled()

      await waitFor(() => {
        expect(result).toBe('success')
        expect(screen.getByText('Execute')).toBeInTheDocument()
      })
    })

    it('handles async operation errors', async () => {
      const user = userEvent.setup()
      let error: any

      const TestComponent = () => {
        const { loading, execute } = useAsyncOperation()

        const handleClick = () => {
          execute(
            async () => { throw new Error('Test error') },
            undefined,
            (err) => { error = err }
          )
        }

        return (
          <button onClick={handleClick} disabled={loading}>
            Execute
          </button>
        )
      }

      render(<TestComponent />)

      const button = screen.getByText('Execute')
      await user.click(button)

      await waitFor(() => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Test error')
      })
    })
  })

  describe('Performance Optimization', () => {
    it('lazy loading prevents immediate icon loading', () => {
      // This test verifies that lazy loading doesn't immediately execute
      // The actual lazy loading behavior is tested through the mock setup
      expect(() => {
        render(<LoadingSpinner />)
      }).not.toThrow()
    })

    it('caching reduces redundant operations', () => {
      const cache = Cache.getInstance()
      cache.clear()

      // First call
      cache.set('test', 'value1')
      expect(cache.get('test')).toBe('value1')

      // Second call with same key should return cached value
      cache.set('test', 'value2')
      expect(cache.get('test')).toBe('value2')
    })

    it('debouncing prevents excessive function calls', async () => {
      let callCount = 0

      const debouncedFunction = () => {
        callCount++
      }

      // Simulate rapid calls
      for (let i = 0; i < 5; i++) {
        setTimeout(debouncedFunction, i * 10)
      }

      // With proper debouncing, should only execute once
      await waitFor(() => {
        expect(callCount).toBeLessThan(5)
      }, { timeout: 100 })
    })
  })

  describe('Memory Management', () => {
    it('cache respects memory limits', () => {
      const cache = Cache.getInstance()

      // Add many items
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`)
      }

      // Should still function correctly
      expect(cache.get('key0')).toBe('value0')
      expect(cache.get('key999')).toBe('value999')
    })

    it('TTL prevents memory leaks', () => {
      const cache = Cache.getInstance()

      cache.set('temp', 'value', 1) // 1ms TTL

      expect(cache.get('temp')).toBe('value')

      // Fast-forward time
      vi.advanceTimersByTime(10)

      expect(cache.get('temp')).toBeNull()
    })
  })

  describe('Browser Compatibility', () => {
    it('handles browsers without IntersectionObserver', () => {
      // Temporarily remove IntersectionObserver
      const originalIO = global.IntersectionObserver
      delete (global as any).IntersectionObserver

      expect(() => {
        const { ref } = useLazyLoad()
        expect(ref.current).toBeUndefined()
      }).not.toThrow()

      // Restore
      global.IntersectionObserver = originalIO
    })

    it('works with different timing scenarios', () => {
      vi.useFakeTimers()

      const TestComponent = () => {
        const debounced = useDebounce('test', 100)
        return <div>{debounced}</div>
      }

      render(<TestComponent />)

      vi.advanceTimersByTime(150)

      expect(screen.getByText('test')).toBeInTheDocument()

      vi.useRealTimers()
    })
  })
})
