import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarLayout } from '../../src/components/SidebarLayout'
import { trpc } from '../../src/lib/trpc'

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ['/', vi.fn()],
}))

// Mock trpc
vi.mock('../../src/lib/trpc', () => ({
  trpc: {
    pillars: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
    simulations: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
  },
}))

// Mock useAuth
vi.mock('@/_core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      openId: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      loginMethod: 'manus',
      role: 'user',
      vosRole: 'Sales',
      maturityLevel: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    logout: vi.fn(),
  }),
}))

// Mock icons
vi.mock('../../src/lib/icons', () => ({
  Icons: {
    Home: ({ children, ...props }: any) => <div data-testid="home-icon" {...props}>{children}</div>,
    BookOpen: ({ children, ...props }: any) => <div data-testid="book-icon" {...props}>{children}</div>,
    Gamepad2: ({ children, ...props }: any) => <div data-testid="gamepad-icon" {...props}>{children}</div>,
    TreePine: ({ children, ...props }: any) => <div data-testid="treepine-icon" {...props}>{children}</div>,
    BarChart3: ({ children, ...props }: any) => <div data-testid="barchart-icon" {...props}>{children}</div>,
    Brain: ({ children, ...props }: any) => <div data-testid="brain-icon" {...props}>{children}</div>,
    Trophy: ({ children, ...props }: any) => <div data-testid="trophy-icon" {...props}>{children}</div>,
    User: ({ children, ...props }: any) => <div data-testid="user-icon" {...props}>{children}</div>,
    Search: ({ children, ...props }: any) => <div data-testid="search-icon" {...props}>{children}</div>,
    Menu: ({ children, ...props }: any) => <div data-testid="menu-icon" {...props}>{children}</div>,
    X: ({ children, ...props }: any) => <div data-testid="x-icon" {...props}>{children}</div>,
    HelpCircle: ({ children, ...props }: any) => <div data-testid="help-icon" {...props}>{children}</div>,
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('SidebarLayout', () => {
  const Wrapper = createWrapper()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Desktop Layout', () => {
    it('renders navigation items correctly', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('VOS Academy')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Learning Pillars')).toBeInTheDocument()
      expect(screen.getByText('Simulations')).toBeInTheDocument()
      expect(screen.getByText('Value Tree Builder')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('AI Tutor')).toBeInTheDocument()
      expect(screen.getByText('Certifications')).toBeInTheDocument()
      expect(screen.getByText('Resources')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
    })

    it('displays user information when logged in', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('Sales')).toBeInTheDocument()
    })

    it('shows logout button when user is authenticated', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('displays main content area', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content Area</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('Test Content Area')).toBeInTheDocument()
    })

    it('includes search functionality', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('readonly')
    })
  })

  describe('Search Functionality', () => {
    it('opens search dialog when search input is clicked', async () => {
      const user = userEvent.setup()

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search')
      await user.click(searchInput)

      await waitFor(() => {
        expect(screen.getByText('Search VOS Academy')).toBeInTheDocument()
      })
    })

    it('filters search results based on input', async () => {
      const user = userEvent.setup()

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search')
      await user.click(searchInput)

      const searchField = screen.getByLabelText('Search VOS Academy content')
      await user.type(searchField, 'simul')

      await waitFor(() => {
        expect(screen.getByText(/Simulations/i)).toBeInTheDocument()
      })
    })

    it('closes search dialog when escape is pressed', async () => {
      const user = userEvent.setup()

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search')
      await user.click(searchInput)

      expect(screen.getByText('Search VOS Academy')).toBeInTheDocument()

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('Search VOS Academy')).not.toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('highlights active navigation item', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      // Home should be active when on "/" route
      const homeLink = screen.getByText('Home').closest('a')
      expect(homeLink).toHaveClass('bg-sidebar-primary/10')
    })

    it('navigates to different sections', async () => {
      const user = userEvent.setup()

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const simulationsLink = screen.getByText('Simulations').closest('a')
      expect(simulationsLink).toHaveAttribute('href', '/simulations')
    })
  })

  describe('Responsive Design', () => {
    it('shows mobile header on small screens', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('VA')).toBeInTheDocument()
    })

    it('includes mobile menu toggle', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('includes skip link for screen readers', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const skipLink = screen.getByText('Skip to main content')
      expect(skipLink).toBeInTheDocument()
      expect(skipLink).toHaveAttribute('href', '#main-content')
    })

    it('has proper ARIA labels on interactive elements', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByLabelText('Open search')).toBeInTheDocument()
    })

    it('includes proper heading structure', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })
  })

  describe('Settings and Support', () => {
    it('includes settings option', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('includes support option', () => {
      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      expect(screen.getByText('Support')).toBeInTheDocument()
    })
  })

  describe('User Actions', () => {
    it('calls logout function when logout is clicked', async () => {
      const mockLogout = vi.fn()
      vi.mocked(require('@/_core/hooks/useAuth').useAuth).mockReturnValue({
        user: {
          id: 1,
          openId: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          loginMethod: 'manus',
          role: 'user',
          vosRole: 'Sales',
          maturityLevel: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        logout: mockLogout,
      })

      const user = userEvent.setup()

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      const logoutButton = screen.getByText('Logout')
      await user.click(logoutButton)

      expect(mockLogout).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('handles loading states for navigation data', () => {
      vi.mocked(trpc.pillars.list.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
      })

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      // Component should still render without crashing
      expect(screen.getByText('VOS Academy')).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('handles query errors gracefully', () => {
      vi.mocked(trpc.pillars.list.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load pillars'),
      })

      render(
        <Wrapper>
          <SidebarLayout>
            <div>Test Content</div>
          </SidebarLayout>
        </Wrapper>
      )

      // Component should still render without crashing
      expect(screen.getByText('VOS Academy')).toBeInTheDocument()
    })
  })
})
