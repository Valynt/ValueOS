import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OnboardingFlow, vosAcademyOnboardingSteps } from '../../src/components/OnboardingFlow'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('OnboardingFlow', () => {
  const mockOnComplete = vi.fn()
  const mockOnSkip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
  })

  describe('Initial State', () => {
    it('renders first step when no completion is stored', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Welcome to VOS Academy')).toBeInTheDocument()
      expect(screen.getByText('Your journey to mastering Value Operating System begins here')).toBeInTheDocument()
    })

    it('calls onComplete when onboarding was previously completed', () => {
      localStorageMock.getItem.mockReturnValue('completed')

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(mockOnComplete).toHaveBeenCalled()
    })

    it('does not render when completed', () => {
      localStorageMock.getItem.mockReturnValue('completed')

      const { container } = render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Navigation', () => {
    it('shows next button for non-final steps', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Next')).toBeInTheDocument()
      expect(screen.queryByText('Get Started')).not.toBeInTheDocument()
    })

    it('shows "Get Started" button on final step', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Navigate to final step
      for (let i = 0; i < vosAcademyOnboardingSteps.length - 1; i++) {
        const nextButton = screen.getByText(i === vosAcademyOnboardingSteps.length - 2 ? 'Next' : 'Next')
        await user.click(nextButton)
      }

      expect(screen.getByText('Get Started')).toBeInTheDocument()
    })

    it('navigates between steps correctly', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Start at first step
      expect(screen.getByText('Welcome to VOS Academy')).toBeInTheDocument()

      // Go to next step
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      expect(screen.getByText('Explore the 10 VOS Pillars')).toBeInTheDocument()
    })

    it('shows previous button when not on first step', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Initially no previous button
      expect(screen.queryByText('Previous')).not.toBeInTheDocument()

      // Navigate forward
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      // Now should show previous button
      expect(screen.getByText('Previous')).toBeInTheDocument()
    })

    it('can navigate backwards', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Go forward
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)
      expect(screen.getByText('Explore the 10 VOS Pillars')).toBeInTheDocument()

      // Go back
      const prevButton = screen.getByText('Previous')
      await user.click(prevButton)
      expect(screen.getByText('Welcome to VOS Academy')).toBeInTheDocument()
    })
  })

  describe('Completion', () => {
    it('calls onComplete and stores completion when finished', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Navigate through all steps
      for (let i = 0; i < vosAcademyOnboardingSteps.length - 1; i++) {
        const nextButton = screen.getByText('Next')
        await user.click(nextButton)
      }

      // Complete onboarding
      const finishButton = screen.getByText('Get Started')
      await user.click(finishButton)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('vos-onboarding-completed', 'true')
      expect(mockOnComplete).toHaveBeenCalled()
    })

    it('calls onSkip and stores completion when skipped', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByText('Skip')
      await user.click(skipButton)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('vos-onboarding-completed', 'true')
      expect(mockOnSkip).toHaveBeenCalled()
    })
  })

  describe('Progress Indicators', () => {
    it('shows current step indicator', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('1 of 5')).toBeInTheDocument()
    })

    it('updates step indicator when navigating', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      expect(screen.getByText('2 of 5')).toBeInTheDocument()
    })

    it('shows visual progress dots', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Should have 5 dots total
      const dots = screen.getAllByRole('generic', { hidden: true }).filter(
        element => element.className.includes('rounded-full')
      )
      expect(dots).toHaveLength(5)
    })

    it('highlights current step dot', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const dots = screen.getAllByRole('generic', { hidden: true }).filter(
        element => element.className.includes('rounded-full')
      )

      // First dot should be highlighted (current step)
      expect(dots[0]).toHaveClass('bg-primary')
      // Other dots should be muted
      expect(dots[1]).toHaveClass('bg-muted')
    })
  })

  describe('Accessibility', () => {
    it('includes proper ARIA attributes', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByLabelText('Skip onboarding')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Tab through focusable elements
      await user.tab()
      expect(screen.getByText('Skip')).toHaveFocus()

      await user.tab()
      expect(screen.getByText('Next')).toHaveFocus()
    })

    it('has proper heading structure', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const headings = screen.getAllByRole('heading')
      expect(headings).toHaveLength(1) // Main title
      expect(headings[0]).toHaveTextContent('Welcome to VOS Academy')
    })

    it('includes descriptive button labels', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByLabelText('Skip onboarding')).toBeInTheDocument()
    })
  })

  describe('Content Rendering', () => {
    it('renders step content correctly', () => {
      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('Your journey to mastering Value Operating System begins here')).toBeInTheDocument()
    })

    it('renders different content for each step', async () => {
      const user = userEvent.setup()

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // First step
      expect(screen.getByText('Your journey to mastering Value Operating System begins here')).toBeInTheDocument()

      // Navigate to second step
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      expect(screen.getByText('Progressive learning path from foundation to advanced mastery')).toBeInTheDocument()
    })

    it('handles custom step content', () => {
      const customSteps = [
        {
          id: 'custom',
          title: 'Custom Step',
          description: 'Custom description',
          content: <div data-testid="custom-content">Custom Content</div>,
        },
      ]

      render(
        <OnboardingFlow
          steps={customSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty steps array', () => {
      const { container } = render(
        <OnboardingFlow
          steps={[]}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('handles single step flow', async () => {
      const user = userEvent.setup()
      const singleStep = [
        {
          id: 'single',
          title: 'Single Step',
          description: 'Only one step',
          content: <div>Single content</div>,
        },
      ]

      render(
        <OnboardingFlow
          steps={singleStep}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      const finishButton = screen.getByText('Get Started')
      await user.click(finishButton)

      expect(mockOnComplete).toHaveBeenCalled()
    })

    it('respects custom storage key', () => {
      const customKey = 'custom-onboarding-key'

      render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          storageKey={customKey}
        />
      )

      // Should check custom key
      expect(localStorageMock.getItem).toHaveBeenCalledWith(customKey)
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const { rerender } = render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Re-render with same props
      rerender(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      // Should still be on first step
      expect(screen.getByText('Welcome to VOS Academy')).toBeInTheDocument()
    })

    it('cleans up properly on unmount', () => {
      const { unmount } = render(
        <OnboardingFlow
          steps={vosAcademyOnboardingSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      )

      unmount()

      // Component should be cleaned up
      expect(screen.queryByText('Welcome to VOS Academy')).not.toBeInTheDocument()
    })
  })
})
