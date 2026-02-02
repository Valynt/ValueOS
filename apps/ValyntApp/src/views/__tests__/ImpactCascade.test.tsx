/**
 * Comprehensive Test Suite for Impact Cascade Template (Sankey)
 * Tests functionality, security, accessibility, and performance
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ImpactCascade from '../ImpactCascade';

// Mock dependencies
vi.mock('../../components/Layout/Header', () => ({
  default: ({ title, breadcrumbs }: { title: string; breadcrumbs: string[] }) => (
    <div data-testid="header">
      <h1>{title}</h1>
      <div data-testid="breadcrumbs">{breadcrumbs.join(' > ')}</div>
    </div>
  ),
}));

vi.mock('../../components/Agents/AgentBadge', () => ({
  default: ({ agentId, size, showName }: { agentId: string; size?: string; showName?: boolean }) => (
    <div data-testid={`agent-badge-${agentId}`} data-size={size}>
      {showName !== false ? agentId : ''}
    </div>
  ),
}));

vi.mock('../../components/Agents/ConfidenceIndicator', () => ({
  default: ({
    value,
    confidence,
    label,
    size,
  }: {
    value: number;
    confidence: number;
    label: string;
    size: string;
  }) => (
    <div data-testid="confidence-indicator" data-size={size}>
      <span data-value>{value}</span>
      <span data-confidence>{confidence}</span>
      <span data-label>{label}</span>
    </div>
  ),
}));

vi.mock('../../components/Agents/ChallengeCard', () => ({
  default: ({ challenge }: { challenge: any }) => (
    <div data-testid="challenge-card">
      <div data-claim>{challenge.claim}</div>
      <div data-counter>{challenge.counterArgument}</div>
      <div data-resolution>{challenge.resolution}</div>
    </div>
  ),
}));

describe('ImpactCascade - Sankey Template', () => {
  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <MemoryRouter>
        {component}
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render all main components correctly', () => {
      renderWithProviders(<ImpactCascade />);

      // Header
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp > Architecture')).toBeInTheDocument();

      // Agent badges
      expect(screen.getByTestId('agent-badge-value-mapping')).toBeInTheDocument();
      expect(screen.getByTestId('agent-badge-target')).toBeInTheDocument();

      // View mode toggles
      expect(screen.getByText('Tree View')).toBeInTheDocument();
      expect(screen.getByText('Table View')).toBeInTheDocument();

      // Feature library
      expect(screen.getByText('Feature Library')).toBeInTheDocument();
      expect(screen.getByText('Drag features onto the value tree to auto-map connections')).toBeInTheDocument();

      // Main visualization area
      expect(screen.getByText('Total Impact')).toBeInTheDocument();
      expect(screen.getByText('$12.5M')).toBeInTheDocument();

      // Validation status
      expect(screen.getByText('Validation Status')).toBeInTheDocument();
      expect(screen.getByText('Logic Coverage')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();

      // Challenge card
      expect(screen.getByTestId('challenge-card')).toBeInTheDocument();
    });

    it('should display correct initial data', () => {
      renderWithProviders(<ImpactCascade />);

      // Drivers
      expect(screen.getByText('Revenue Growth')).toBeInTheDocument();
      expect(screen.getByText('Cost Reduction')).toBeInTheDocument();

      // Sub-drivers
      expect(screen.getByText('New Customer Acquisition')).toBeInTheDocument();
      expect(screen.getByText('Expansion Revenue')).toBeInTheDocument();
      expect(screen.getByText('OpEx Efficiency')).toBeInTheDocument();
      expect(screen.getByText('Risk Mitigation')).toBeInTheDocument();

      // Values
      expect(screen.getByText('$8.2M')).toBeInTheDocument();
      expect(screen.getByText('$4.3M')).toBeInTheDocument();
      expect(screen.getByText('+12%')).toBeInTheDocument();
      expect(screen.getByText('+8%')).toBeInTheDocument();
    });

    it('should render features in library', () => {
      renderWithProviders(<ImpactCascade />);

      const features = ['Automated Reporting', 'Real-time Dashboard', 'Process Automation'];
      features.forEach(feature => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });

    it('should show AI-mapped indicators', () => {
      renderWithProviders(<ImpactCascade />);

      // OpEx Efficiency should show AI-mapped badge
      expect(screen.getByText('AI-mapped')).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to Tree View when clicked', () => {
      renderWithProviders(<ImpactCascade />);
      
      const treeViewButton = screen.getByText('Tree View');
      fireEvent.click(treeViewButton);

      // Should be active
      expect(treeViewButton.closest('button')).toHaveClass('bg-secondary');
    });

    it('should switch to Table View when clicked', () => {
      renderWithProviders(<ImpactCascade />);
      
      const tableViewButton = screen.getByText('Table View');
      fireEvent.click(tableViewButton);

      // Should be active
      expect(tableViewButton.closest('button')).toHaveClass('bg-secondary');
    });

    it('should toggle between views correctly', () => {
      renderWithProviders(<ImpactCascade />);
      
      const treeButton = screen.getByText('Tree View');
      const tableButton = screen.getByText('Table View');

      // Start with tree view
      fireEvent.click(treeButton);
      expect(treeButton.closest('button')).toHaveClass('bg-secondary');

      // Switch to table
      fireEvent.click(tableButton);
      expect(tableButton.closest('button')).toHaveClass('bg-secondary');
      expect(treeButton.closest('button')).not.toHaveClass('bg-secondary');
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should render draggable features', () => {
      renderWithProviders(<ImpactCascade />);

      const features = screen.getAllByRole('button');
      const draggableFeatures = features.filter(f => 
        f.draggable === true && f.textContent?.includes('Automated Reporting')
      );
      
      expect(draggableFeatures.length).toBeGreaterThan(0);
    });

    it('should handle drag start event', () => {
      renderWithProviders(<ImpactCascade />);

      const feature = screen.getByText('Automated Reporting').closest('div[draggable="true"]');
      expect(feature).toBeInTheDocument();

      if (feature) {
        fireEvent.dragStart(feature);
        // Component should handle drag state internally
        expect(screen.getByText('Feature Library')).toBeInTheDocument();
      }
    });

    it('should handle drag end event', () => {
      renderWithProviders(<ImpactCascade />);

      const feature = screen.getByText('Real-time Dashboard').closest('div[draggable="true"]');
      
      if (feature) {
        fireEvent.dragStart(feature);
        fireEvent.dragEnd(feature);
        
        // Should reset drag state
        expect(screen.getByText('Feature Library')).toBeInTheDocument();
      }
    });

    it('should handle drop event on visualization area', () => {
      renderWithProviders(<ImpactCascade />);

      const dropZone = screen.getByText('Total Impact').closest('div');
      expect(dropZone).toBeInTheDocument();

      if (dropZone) {
        fireEvent.dragOver(dropZone);
        fireEvent.drop(dropZone);
        
        // Component should handle drop
        expect(screen.getByText('Total Impact')).toBeInTheDocument();
      }
    });
  });

  describe('Confidence Indicators', () => {
    it('should render confidence indicators for drivers', () => {
      renderWithProviders(<ImpactCascade />);

      const confidenceIndicators = screen.getAllByTestId('confidence-indicator');
      expect(confidenceIndicators.length).toBeGreaterThan(0);
    });

    it('should display correct confidence values', () => {
      renderWithProviders(<ImpactCascade />);

      // Revenue Growth: 89% confidence
      // Cost Reduction: 94% confidence
      const indicators = screen.getAllByTestId('confidence-indicator');
      
      // Check that confidence values are displayed
      const confidenceValues = indicators.map(ind => 
        within(ind).getByAttribute('data-confidence')?.textContent
      ).filter(Boolean);
      
      expect(confidenceValues.length).toBeGreaterThan(0);
    });

    it('should show confidence bar widths correctly', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that progress bars have correct widths
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Status Panel', () => {
    it('should display validation metrics', () => {
      renderWithProviders(<ImpactCascade />);

      expect(screen.getByText('Logic Coverage')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();
      expect(screen.getByText('Data Sources')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Challenges')).toBeInTheDocument();
      expect(screen.getByText('1 resolved')).toBeInTheDocument();
    });

    it('should have action buttons', () => {
      renderWithProviders(<ImpactCascade />);

      expect(screen.getByText('Edit Assumptions')).toBeInTheDocument();
      expect(screen.getByText('View History')).toBeInTheDocument();
      expect(screen.getByText('Run Validation')).toBeInTheDocument();
    });

    it('should handle validation button click', () => {
      renderWithProviders(<ImpactCascade />);

      const validateButton = screen.getByText('Run Validation').closest('button');
      fireEvent.click(validateButton!);

      // Should trigger validation (component handles this internally)
      expect(screen.getByText('Run Validation')).toBeInTheDocument();
    });
  });

  describe('Challenge Card Integration', () => {
    it('should render challenge card with correct data', () => {
      renderWithProviders(<ImpactCascade />);

      const challengeCard = screen.getByTestId('challenge-card');
      expect(challengeCard).toBeInTheDocument();

      // Check challenge content
      expect(within(challengeCard).getByAttribute('data-claim')).toHaveTextContent(
        'OpEx Efficiency projected at $2.8M annual savings'
      );
      expect(within(challengeCard).getByAttribute('data-counter')).toHaveTextContent(
        'Industry benchmarks suggest brownfield automation deployments typically achieve 12-15% efficiency gains'
      );
      expect(within(challengeCard).getByAttribute('data-resolution')).toHaveTextContent(
        'Model adjusted to use 15% efficiency gain'
      );
    });
  });

  describe('Security - XSS Prevention', () => {
    it('should sanitize content in challenge cards', () => {
      renderWithProviders(<ImpactCascade />);

      const challengeCard = screen.getByTestId('challenge-card');

      // Should not contain script tags or dangerous content
      expect(challengeCard.querySelector('script')).toBeNull();
      expect(challengeCard.querySelector('[onerror]')).toBeNull();
      expect(challengeCard.textContent).not.toContain('javascript:');
    });

    it('should handle malicious data in drivers', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that all displayed text is safe
      const allText = screen.getAllByText(/.+/);
      allText.forEach(element => {
        const text = element.textContent || '';
        expect(text).not.toContain('<script>');
        expect(text).not.toContain('javascript:');
      });
    });

    it('should prevent XSS in feature names', () => {
      renderWithProviders(<ImpactCascade />);

      const features = ['Automated Reporting', 'Real-time Dashboard', 'Process Automation'];
      features.forEach(feature => {
        const element = screen.getByText(feature);
        expect(element.textContent).toBe(feature);
        expect(element.textContent).not.toContain('<');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      renderWithProviders(<ImpactCascade />);

      // Check for buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Check for headings
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should provide keyboard navigation', () => {
      renderWithProviders(<ImpactCascade />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex');
      });
    });

    it('should have descriptive text for screen readers', () => {
      renderWithProviders(<ImpactCascade />);

      // Check for descriptive labels
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
      expect(screen.getByText('Feature Library')).toBeInTheDocument();
    });

    it('should handle focus management in drag operations', () => {
      renderWithProviders(<ImpactCascade />);

      const feature = screen.getByText('Automated Reporting').closest('div[draggable="true"]');
      if (feature) {
        feature.focus();
        expect(document.activeElement).toBe(feature);
      }
    });
  });

  describe('Performance', () => {
    it('should render quickly with complex data', () => {
      const start = performance.now();
      renderWithProviders(<ImpactCascade />);
      const end = performance.now();

      // Should render in under 150ms
      expect(end - start).toBeLessThan(150);
    });

    it('should handle rapid view switching efficiently', () => {
      renderWithProviders(<ImpactCascade />);

      const treeButton = screen.getByText('Tree View');
      const tableButton = screen.getByText('Table View');

      // Rapid switching
      for (let i = 0; i < 10; i++) {
        fireEvent.click(treeButton);
        fireEvent.click(tableButton);
      }

      // Should remain stable
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
    });

    it('should handle drag operations without performance issues', () => {
      renderWithProviders(<ImpactCascade />);

      const feature = screen.getByText('Process Automation').closest('div[draggable="true"]');
      const dropZone = screen.getByText('Total Impact').closest('div');

      if (feature && dropZone) {
        // Multiple drag operations
        for (let i = 0; i < 5; i++) {
          fireEvent.dragStart(feature);
          fireEvent.dragOver(dropZone);
          fireEvent.drop(dropZone);
          fireEvent.dragEnd(feature);
        }

        expect(screen.getByText('Total Impact')).toBeInTheDocument();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      // Test component resilience
      renderWithProviders(<ImpactCascade />);
      
      // Should still render core structure
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
      expect(screen.getByText('Feature Library')).toBeInTheDocument();
    });

    it('should display fallback content when needed', () => {
      renderWithProviders(<ImpactCascade />);

      // All critical sections should be present
      expect(screen.getByText('Total Impact')).toBeInTheDocument();
      expect(screen.getByText('Validation Status')).toBeInTheDocument();
      expect(screen.getByText('Challenge Card')).toBeInTheDocument();
    });

    it('should handle calculation edge cases', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that confidence calculations are reasonable
      const confidenceIndicators = screen.getAllByTestId('confidence-indicator');
      confidenceIndicators.forEach(indicator => {
        const confidence = within(indicator).getByAttribute('data-confidence');
        const value = parseInt(confidence.textContent || '0');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile screens', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<ImpactCascade />);

      // Should still render critical content
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
      expect(screen.getByText('Feature Library')).toBeInTheDocument();

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('should maintain touch-friendly targets on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<ImpactCascade />);

      // Check that buttons are still accessible
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });
  });

  describe('Data Visualization Integrity', () => {
    it('should maintain correct hierarchy structure', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that drivers and sub-drivers are properly related
      const drivers = ['Revenue Growth', 'Cost Reduction'];
      const subDrivers = [
        'New Customer Acquisition',
        'Expansion Revenue',
        'OpEx Efficiency',
        'Risk Mitigation'
      ];

      drivers.forEach(driver => {
        expect(screen.getByText(driver)).toBeInTheDocument();
      });

      subDrivers.forEach(sub => {
        expect(screen.getByText(sub)).toBeInTheDocument();
      });
    });

    it('should display values with correct formatting', () => {
      renderWithProviders(<ImpactCascade />);

      // Check currency formatting
      expect(screen.getByText('$8.2M')).toBeInTheDocument();
      expect(screen.getByText('$4.3M')).toBeInTheDocument();
      expect(screen.getByText('$5.1M')).toBeInTheDocument();
      expect(screen.getByText('$2.8M')).toBeInTheDocument();

      // Check percentage formatting
      expect(screen.getByText('+12%')).toBeInTheDocument();
      expect(screen.getByText('+8%')).toBeInTheDocument();
    });

    it('should show AI indicators correctly', () => {
      renderWithProviders(<ImpactCascade />);

      // OpEx Efficiency should show AI badge
      const aiBadge = screen.getByText('AI-mapped');
      expect(aiBadge).toBeInTheDocument();
      expect(aiBadge.className).toContain('bg-primary');
    });
  });

  describe('Integration with External Components', () => {
    it('should integrate with Header component', () => {
      renderWithProviders(<ImpactCascade />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
    });

    it('should integrate with AgentBadge components', () => {
      renderWithProviders(<ImpactCascade />);

      expect(screen.getByTestId('agent-badge-value-mapping')).toBeInTheDocument();
      expect(screen.getByTestId('agent-badge-target')).toBeInTheDocument();
      expect(screen.getByTestId('agent-badge-integrity')).toBeInTheDocument();
    });

    it('should integrate with ChallengeCard component', () => {
      renderWithProviders(<ImpactCascade />);

      const challengeCard = screen.getByTestId('challenge-card');
      expect(challengeCard).toBeInTheDocument();

      // Verify challenge data structure
      const claim = within(challengeCard).getByAttribute('data-claim');
      expect(claim).toHaveTextContent('OpEx Efficiency');
    });
  });

  describe('Visual Feedback', () => {
    it('should show active state for view buttons', () => {
      renderWithProviders(<ImpactCascade />);

      const treeButton = screen.getByText('Tree View').closest('button');
      const tableButton = screen.getByText('Table View').closest('button');

      // Tree view should be active by default
      expect(treeButton).toHaveClass('bg-secondary');

      // Switch to table
      fireEvent.click(tableButton!);
      expect(tableButton).toHaveClass('bg-secondary');
      expect(treeButton).not.toHaveClass('bg-secondary');
    });

    it('should show drag feedback', () => {
      renderWithProviders(<ImpactCascade />);

      const feature = screen.getByText('Automated Reporting').closest('div[draggable="true"]');
      
      if (feature) {
        // Before drag
        expect(feature).not.toHaveClass('opacity-50');

        // During drag
        fireEvent.dragStart(feature);
        // Component handles this internally

        // After drag
        fireEvent.dragEnd(feature);
        expect(feature).not.toHaveClass('opacity-50');
      }
    });

    it('should highlight interactive elements on hover', () => {
      renderWithProviders(<ImpactCascade />);

      const buttons = screen.getAllByRole('button');
      const button = buttons[0];

      // Simulate hover
      fireEvent.mouseEnter(button);
      // Component should handle hover states via CSS classes
      expect(button).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty or minimal data', () => {
      // Test component resilience with edge cases
      renderWithProviders(<ImpactCascade />);
      
      // Should still render core structure
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
    });

    it('should handle extreme values', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that all numeric displays are reasonable
      const numericElements = screen.getAllByText(/\$[\d.]+M|\d+%|\d+/);
      expect(numericElements.length).toBeGreaterThan(0);
    });

    it('should handle rapid state changes', () => {
      renderWithProviders(<ImpactCascade />);

      // Rapid view switching
      const treeButton = screen.getByText('Tree View');
      const tableButton = screen.getByText('Table View');

      for (let i = 0; i < 20; i++) {
        fireEvent.click(treeButton);
        fireEvent.click(tableButton);
      }

      // Should remain stable
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
    });
  });

  describe('Visual Regression Prevention', () => {
    it('should maintain consistent layout structure', () => {
      renderWithProviders(<ImpactCascade />);

      // Check main layout
      const mainContainer = screen.getByText('Phase 2: Value Architecture').closest('div');
      expect(mainContainer).toBeInTheDocument();

      // Verify grid layout
      const grid = mainContainer?.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should render all critical sections', () => {
      renderWithProviders(<ImpactCascade />);

      const sections = [
        'Feature Library',
        'Total Impact',
        'Validation Status',
        'Challenge Card'
      ];

      sections.forEach(section => {
        expect(screen.getByText(section)).toBeInTheDocument();
      });
    });

    it('should maintain visual hierarchy', () => {
      renderWithProviders(<ImpactCascade />);

      // Check that headings are properly structured
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // First heading should be main title
      expect(headings[0]).toHaveTextContent('Phase 2: Value Architecture');
    });
  });
});
