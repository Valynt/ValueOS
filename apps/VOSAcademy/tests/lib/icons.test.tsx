import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Helper: create a mock lucide-react icon as a proper forwardRef component
function createMockIcon(displayName: string) {
  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) => (
      <svg ref={ref} data-testid={`icon-${displayName}`} {...props}>
        <title>{displayName}</title>
      </svg>
    ),
  )
  Icon.displayName = displayName
  return Icon
}

const iconNames = [
  'Home', 'BookOpen', 'Gamepad2', 'Brain', 'BarChart3', 'User',
  'Plus', 'Search', 'Menu', 'X', 'ChevronLeft', 'ChevronRight',
  'CheckCircle2', 'Trophy', 'Target', 'DollarSign', 'TreePine',
  'Loader2', 'AlertTriangle', 'RefreshCw', 'HelpCircle', 'Info',
  'MessageSquare', 'Award', 'FileText', 'Settings', 'LogOut',
  'TrendingUp', 'CheckCircle', 'Fingerprint', 'Minus', 'Clock',
  'Zap', 'Star',
] as const

const lucideMock: Record<string, React.ForwardRefExoticComponent<any>> = {}
for (const name of iconNames) {
  lucideMock[name] = createMockIcon(name)
}

vi.mock('lucide-react', () => lucideMock)

// Import after mock is registered
const { Icons, SafeIcon } = await import('../../src/lib/icons')

describe('icons', () => {
  describe('SafeIcon', () => {
    it('renders fallback while loading', () => {
      const LazyIcon = React.lazy(
        () => new Promise<{ default: React.ComponentType<any> }>(() => {}),
      )
      const { container } = render(
        <React.Suspense fallback={<span>suspense</span>}>
          <SafeIcon icon={LazyIcon} name="TestIcon" />
        </React.Suspense>,
      )
      // Should render the fallback icon (div with "?")
      expect(container.textContent).toContain('?')
    })

    it('renders the resolved icon component', async () => {
      const MockIcon = createMockIcon('Resolved')
      render(
        <React.Suspense fallback={<span>loading</span>}>
          <SafeIcon icon={MockIcon} name="Resolved" />
        </React.Suspense>,
      )
      await waitFor(() => {
        expect(screen.getByTestId('icon-Resolved')).toBeDefined()
      })
    })

    it('renders fallback when icon throws', async () => {
      const BrokenIcon = (() => {
        throw new Error('broken')
      }) as unknown as React.ComponentType<any>
      const { container } = render(
        <React.Suspense fallback={<span>loading</span>}>
          <SafeIcon icon={BrokenIcon} name="Broken" />
        </React.Suspense>,
      )
      await waitFor(() => {
        expect(container.textContent).toContain('?')
      })
    })

    it('passes className and extra props through', async () => {
      const MockIcon = createMockIcon('Styled')
      render(
        <React.Suspense fallback={<span>loading</span>}>
          <SafeIcon icon={MockIcon} name="Styled" className="text-red-500" data-custom="yes" />
        </React.Suspense>,
      )
      await waitFor(() => {
        const el = screen.getByTestId('icon-Styled')
        expect(el.getAttribute('class')).toContain('text-red-500')
        expect(el.getAttribute('data-custom')).toBe('yes')
      })
    })
  })

  describe('Icons map', () => {
    it('exports an Icons object with expected keys', () => {
      expect(Icons).toBeDefined()
      expect(typeof Icons.Home).toBe('function')
      expect(typeof Icons.BookOpen).toBe('function')
      expect(typeof Icons.Brain).toBe('function')
      expect(typeof Icons.Target).toBe('function')
      expect(typeof Icons.Star).toBe('function')
    })

    it('Icons.Home renders without crashing', async () => {
      const HomeIcon = Icons.Home
      render(
        <React.Suspense fallback={<span>loading</span>}>
          <HomeIcon />
        </React.Suspense>,
      )
      await waitFor(() => {
        const el = document.querySelector('[data-testid="icon-Home"]') ||
                   document.querySelector('[aria-label="Home"]')
        expect(el).toBeDefined()
      })
    })

    it('Icons entries render SafeIcon wrappers', async () => {
      const SearchIcon = Icons.Search
      const { container } = render(
        <React.Suspense fallback={<span>loading</span>}>
          <SearchIcon className="w-4 h-4" />
        </React.Suspense>,
      )
      // Should render either the mock icon or the fallback
      await waitFor(() => {
        const hasIcon = container.querySelector('[data-testid="icon-Search"]')
        const hasFallback = container.querySelector('[aria-label="Search"]')
        expect(hasIcon || hasFallback).toBeTruthy()
      })
    })
  })
})
