import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GuidedTour, tours } from '../../src/components/GuidedTour'

// Mock document.querySelector
const mockQuerySelector = vi.fn()
Object.defineProperty(document, 'querySelector', {
  value: mockQuerySelector,
  writable: true,
})

describe('GuidedTour', () => {
  const mockOnComplete = vi.fn()
  const mockOnSkip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock different elements for different selectors
    mockQuerySelector.mockImplementation((selector: string) => {
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        getBoundingClientRect: vi.fn(() => ({
          top: 100,
          left: 200,
          width: 300,
          height: 50,
        })),
      }
      return mockElement
    })
  })

  describe('Tour Rendering', () => {
    it('renders tour when target element exists', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/This is your personalized learning dashboard/)).toBeInTheDocument()
    })

    it('does not render when target element does not exist', () => {
      mockQuerySelector.mockReturnValue(null)

      const { container } = render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('positions tour content correctly', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Tour content should be positioned
      const tourContent = screen.getByText('Welcome to Your Dashboard').closest('div')
      expect(tourContent).toHaveStyle({
        position: 'absolute',
        top: '116px', // 100 + 16 offset
        left: '200px',
      })
    })
  })

  describe('Navigation', () => {
    it('starts with first step', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument()
      expect(screen.queryByText('Explore the 10 VOS Pillars')).not.toBeInTheDocument()
    })

    it('navigates to next step', async () => {
      const user = userEvent.setup()

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      expect(screen.getByText('Your Learning Progress')).toBeInTheDocument()
    })

    it('completes tour on final step', async () => {
      const user = userEvent.setup()

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Navigate through all steps
      const steps = tours.dashboard
      for (let i = 0; i < steps.length - 1; i++) {
        const nextButton = screen.getByText('Next')
        await user.click(nextButton)
      }

      const finishButton = screen.getByText('Finish')
      await user.click(finishButton)

      expect(mockOnComplete).toHaveBeenCalled()
    })

    it('allows skipping tour', async () => {
      const user = userEvent.setup()

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByText('Skip Tour')
      await user.click(skipButton)

      expect(mockOnSkip).toHaveBeenCalled()
    })
  })

  describe('Visual Indicators', () => {
    it('highlights target element', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        getBoundingClientRect: vi.fn(() => ({
          top: 100,
          left: 200,
          width: 300,
          height: 50,
        })),
      }
      mockQuerySelector.mockReturnValue(mockElement)

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(mockElement.scrollIntoView).toHaveBeenCalled()
      expect(mockElement.classList.add).toHaveBeenCalledWith('ring-2', 'ring-primary', 'ring-offset-2')
    })

    it('removes highlight when tour ends', async () => {
      const user = userEvent.setup()
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        getBoundingClientRect: vi.fn(() => ({
          top: 100,
          left: 200,
          width: 300,
          height: 50,
        })),
      }
      mockQuerySelector.mockReturnValue(mockElement)

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByText('Skip Tour')
      await user.click(skipButton)

      expect(mockElement.classList.remove).toHaveBeenCalledWith('ring-2', 'ring-primary', 'ring-offset-2')
    })

    it('renders overlay to block interactions', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Should have backdrop
      expect(screen.getByTestId('tour-overlay')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('includes proper ARIA attributes', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByLabelText('Close tour')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Tab through focusable elements
      await user.tab()
      expect(screen.getByText('Skip Tour')).toHaveFocus()

      await user.tab()
      expect(screen.getByText('Next')).toHaveFocus()
    })

    it('closes on escape key', async () => {
      const user = userEvent.setup()

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      await user.keyboard('{Escape}')

      expect(mockOnSkip).toHaveBeenCalled()
    })

    it('has proper heading structure', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Welcome to Your Dashboard')
    })
  })

  describe('Step Content', () => {
    it('renders step title and content', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/This is your personalized learning dashboard/)).toBeInTheDocument()
    })

    it('displays action text for steps with actions', () => {
      const stepWithAction = [
        {
          id: 'action-step',
          target: '[data-tour="test"]',
          title: 'Action Step',
          content: 'This step has an action',
          action: {
            label: 'Do Something',
            onClick: vi.fn(),
          },
        },
      ]

      render(
        <GuidedTour
          steps={stepWithAction}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Do Something')).toBeInTheDocument()
    })

    it('shows skip option when specified', () => {
      const stepWithSkip = [
        {
          id: 'skip-step',
          target: '[data-tour="test"]',
          title: 'Skip Step',
          content: 'This step allows skipping',
          showSkip: true,
        },
      ]

      render(
        <GuidedTour
          steps={stepWithSkip}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Skip Tour')).toBeInTheDocument()
    })

    it('hides skip option when showSkip is false', () => {
      const stepWithoutSkip = [
        {
          id: 'no-skip-step',
          target: '[data-tour="test"]',
          title: 'No Skip Step',
          content: 'This step does not allow skipping',
          showSkip: false,
        },
      ]

      render(
        <GuidedTour
          steps={stepWithoutSkip}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.queryByText('Skip Tour')).not.toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('positions tour on the right when specified', () => {
      const rightPositionedStep = [
        {
          id: 'right-step',
          target: '[data-tour="test"]',
          title: 'Right Positioned',
          content: 'This appears on the right',
          position: 'right' as const,
        },
      ]

      render(
        <GuidedTour
          steps={rightPositionedStep}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const tourContent = screen.getByText('Right Positioned').closest('div')
      expect(tourContent).toHaveStyle({
        transform: 'translateX(0px)', // Right positioning
      })
    })

    it('positions tour at bottom when specified', () => {
      const bottomPositionedStep = [
        {
          id: 'bottom-step',
          target: '[data-tour="test"]',
          title: 'Bottom Positioned',
          content: 'This appears at the bottom',
          position: 'bottom' as const,
        },
      ]

      render(
        <GuidedTour
          steps={bottomPositionedStep}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const tourContent = screen.getByText('Bottom Positioned').closest('div')
      expect(tourContent).toHaveStyle({
        top: '166px', // 100 + 50 + 16 offset
      })
    })
  })

  describe('Tour Management', () => {
    it('prevents interaction with background elements', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const overlay = screen.getByTestId('tour-overlay')
      expect(overlay).toHaveClass('pointer-events-none')
    })

    it('allows clicking tour controls', () => {
      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const nextButton = screen.getByText('Next')
      expect(nextButton).toHaveClass('pointer-events-auto')
    })

    it('scrolls target element into view', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        getBoundingClientRect: vi.fn(() => ({
          top: 100,
          left: 200,
          width: 300,
          height: 50,
        })),
      }
      mockQuerySelector.mockReturnValue(mockElement)

      render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })
    })
  })

  describe('Performance', () => {
    it('only renders when target element exists', () => {
      mockQuerySelector.mockReturnValue(null)

      const { container } = render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('cleans up highlighting when unmounting', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        getBoundingClientRect: vi.fn(() => ({
          top: 100,
          left: 200,
          width: 300,
          height: 50,
        })),
      }
      mockQuerySelector.mockReturnValue(mockElement)

      const { unmount } = render(
        <GuidedTour
          steps={tours.dashboard}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      unmount()

      expect(mockElement.classList.remove).toHaveBeenCalledWith('ring-2', 'ring-primary', 'ring-offset-2')
    })
  })

  describe('Error Handling', () => {
    it('handles missing target gracefully', () => {
      mockQuerySelector.mockReturnValue(null)

      expect(() => {
        render(
          <GuidedTour
            steps={tours.dashboard}
            onComplete={mockOnComplete}
            onSkip={mockOnSkip}
          />
        )
      }).not.toThrow()
    })

    it('handles malformed step data', () => {
      const malformedSteps = [
        {
          id: 'malformed',
          // Missing required fields
        },
      ]

      expect(() => {
        render(
          <GuidedTour
            steps={malformedSteps as any}
            onComplete={mockOnComplete}
            onSkip={mockOnSkip}
          />
        )
      }).toThrow()
    })
  })
})
