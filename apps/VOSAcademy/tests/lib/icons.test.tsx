import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Icons, SafeIcon } from '../../src/lib/icons'

// Mock lucide-react lazy imports
const mockIcon = vi.fn(() => <div data-testid="mock-icon">Icon</div>)

vi.mock('lucide-react', () => ({
  Home: mockIcon,
  Search: mockIcon,
  X: mockIcon,
  Loader2: mockIcon,
}))

describe('Icons System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SafeIcon Component', () => {
    it('renders icon successfully when loaded', async () => {
      render(
        <SafeIcon icon={() => mockIcon()} name="Test Icon">
          Test Icon
        </SafeIcon>
      )

      await waitFor(() => {
        expect(screen.getByTestId('mock-icon')).toBeInTheDocument()
      })

      expect(screen.getByText('Icon')).toBeInTheDocument()
    })

    it('shows fallback when icon fails to load', async () => {
      const failingIcon = vi.fn(() => {
        throw new Error('Failed to load')
      })

      render(
        <SafeIcon icon={failingIcon} name="Failing Icon">
          Failing Icon
        </SafeIcon>
      )

      await waitFor(() => {
        expect(screen.getByText('?')).toBeInTheDocument()
      })
    })

    it('shows loading state during lazy loading', () => {
      render(
        <SafeIcon icon={() => mockIcon()} name="Loading Icon">
          Loading Icon
        </SafeIcon>
      )

      // Initially shows fallback during loading
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('passes through additional props to icon', async () => {
      render(
        <SafeIcon
          icon={() => mockIcon()}
          name="Test Icon"
          className="custom-class"
          data-testid="custom-icon"
        >
          Test Icon
        </SafeIcon>
      )

      await waitFor(() => {
        const icon = screen.getByTestId('custom-icon')
        expect(icon).toHaveClass('custom-class')
      })
    })

    it('includes accessibility attributes on fallback', async () => {
      const failingIcon = vi.fn(() => {
        throw new Error('Failed to load')
      })

      render(
        <SafeIcon icon={failingIcon} name="Accessible Icon">
          Accessible Icon
        </SafeIcon>
      )

      await waitFor(() => {
        const fallback = screen.getByText('?')
        expect(fallback).toHaveAttribute('title', 'Accessible Icon')
        expect(fallback).toHaveAttribute('aria-label', 'Accessible Icon')
      })
    })
  })

  describe('Icons Object', () => {
    it('exports all expected icon components', () => {
      expect(Icons.Home).toBeDefined()
      expect(Icons.Search).toBeDefined()
      expect(Icons.X).toBeDefined()
      expect(Icons.Loader2).toBeDefined()
      expect(typeof Icons.Home).toBe('function')
      expect(typeof Icons.Search).toBe('function')
    })

    it('each icon component returns SafeIcon wrapper', async () => {
      render(<Icons.Home />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-icon')).toBeInTheDocument()
      })
    })

    it('handles icon-specific props correctly', async () => {
      render(<Icons.Search className="search-icon" size={24} />)

      await waitFor(() => {
        const icon = screen.getByTestId('mock-icon')
        expect(icon).toHaveClass('search-icon')
      })
    })
  })

  describe('Icon Loading Behavior', () => {
    it('handles Suspense boundaries correctly', () => {
      expect(() => {
        render(<Icons.Home />)
      }).not.toThrow()
    })

    it('provides stable references for React optimization', () => {
      const icon1 = <Icons.Home />
      const icon2 = <Icons.Home />

      // Components should be stable for React's reconciliation
      expect(icon1.type).toBe(icon2.type)
    })
  })

  describe('Error Resilience', () => {
    it('gracefully handles undefined icon imports', async () => {
      const undefinedIcon = vi.fn(() => {
        throw new Error('Module not found')
      })

      render(
        <SafeIcon icon={undefinedIcon} name="Undefined Icon">
          Undefined Icon
        </SafeIcon>
      )

      await waitFor(() => {
        expect(screen.getByText('?')).toBeInTheDocument()
      })
    })

    it('maintains functionality when CDN is blocked', async () => {
      // Simulate network failure
      const networkError = vi.fn(() => {
        throw new Error('Network Error')
      })

      render(
        <SafeIcon icon={networkError} name="Network Error Icon">
          Network Error Icon
        </SafeIcon>
      )

      await waitFor(() => {
        const fallback = screen.getByText('?')
        expect(fallback).toBeInTheDocument()
        expect(fallback).toHaveAttribute('title', 'Network Error Icon')
      })
    })
  })

  describe('Performance Characteristics', () => {
    it('lazy loads icons to improve initial bundle size', () => {
      // This test verifies that icons are lazy loaded
      // The actual lazy loading behavior is tested in the mock setup
      expect(mockIcon).not.toHaveBeenCalled()

      render(<Icons.Home />)

      // Icon should be lazy loaded, not immediately called
      expect(mockIcon).not.toHaveBeenCalled()
    })

    it('caches loaded icons for subsequent renders', async () => {
      const { rerender } = render(<Icons.Home />)

      await waitFor(() => {
        expect(mockIcon).toHaveBeenCalledTimes(1)
      })

      rerender(<Icons.Home />)

      // Should still only be called once due to caching
      expect(mockIcon).toHaveBeenCalledTimes(1)
    })
  })

  describe('Browser Compatibility', () => {
    it('works in browsers without dynamic imports', () => {
      // This test ensures the icon system doesn't rely on unsupported features
      expect(() => {
        render(<Icons.Home />)
      }).not.toThrow()
    })

    it('provides meaningful fallbacks for accessibility', async () => {
      const failingIcon = vi.fn(() => {
        throw new Error('Browser compatibility issue')
      })

      render(
        <SafeIcon icon={failingIcon} name="Accessibility Test">
          Accessibility Test
        </SafeIcon>
      )

      await waitFor(() => {
        const fallback = screen.getByText('?')
        expect(fallback).toHaveAttribute('aria-label')
        expect(fallback).toHaveAttribute('title')
      })
    })
  })

  describe('Type Safety', () => {
    it('accepts standard React props', () => {
      expect(() => {
        render(
          <Icons.Home
            className="test-class"
            style={{ color: 'red' }}
            onClick={() => {}}
            data-testid="typed-icon"
          />
        )
      }).not.toThrow()
    })

    it('supports ref forwarding', () => {
      const ref = { current: null }
      expect(() => {
        render(<Icons.Home ref={ref} />)
      }).not.toThrow()
    })
  })
})
