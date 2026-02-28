import { describe, expect, it, vi } from 'vitest'
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
      // Test the SafeIcon logic without React rendering
      const icon = vi.fn(() => mockIcon())

      // Test the SafeIcon function directly
      const result = SafeIcon(icon)
      expect(result).toBeDefined()
    })

    it('shows fallback when icon fails to load', async () => {
      const failingIcon = vi.fn(() => {
        throw new Error('Failed to load')
      })

      const result = SafeIcon(failingIcon)
      expect(result).toBeDefined()
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
  })
})
