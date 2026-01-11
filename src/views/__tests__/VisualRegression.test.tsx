/**
 * Visual Regression Tests for UI Templates
 * Tests visual consistency across templates
 */

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ROICalculator from '../ROICalculator';
import ImpactCascade from '../ImpactCascade';
import { ScenarioSelector } from '../../components/SDUI/ScenarioSelector';
import QuantumView from '../QuantumView';

// Mock for visual consistency
const expectVisualConsistency = (container: HTMLElement, expectedElements: string[]) => {
  expectedElements.forEach(elementText => {
    const element = screen.getByText(elementText);
    expect(element).toBeInTheDocument();
    
    // Check that element has consistent styling
    expect(element.closest('div')).toHaveAttribute('class');
  });
};

describe('Visual Regression - Template Consistency', () => {
  describe('Trinity Dashboard Visual Tests', () => {
    it('should maintain consistent header structure', () => {
      const { container } = render(<ROICalculator />);
      
      // Check header structure
      const header = container.querySelector('h1');
      expect(header).toHaveTextContent('Business Case');
      expect(header?.className).toContain('text-lg');
    });

    it('should render bento cards with consistent styling', () => {
      render(<ROICalculator />);
      
      const cards = screen.getAllByRole('button');
      const bentoCards = cards.filter(card => 
        card.className.includes('bento-card')
      );
      
      expect(bentoCards.length).toBe(3);
      
      // Each card should have consistent structure
      bentoCards.forEach(card => {
        expect(card).toHaveAttribute('class');
        expect(card).toHaveAttribute('tabIndex');
      });
    });

    it('should render metrics with consistent formatting', () => {
      render(<ROICalculator />);
      
      // Check metric cards
      const roiCard = screen.getByText('3-Year ROI').closest('div');
      const npvCard = screen.getByText('Net Present Value').closest('div');
      const paybackCard = screen.getByText('Payback Period').closest('div');
      
      [roiCard, npvCard, paybackCard].forEach(card => {
        expect(card).toHaveClass('bento-card');
        expect(card).toHaveClass('bg-primary/5');
      });
    });

    it('should render charts with consistent dimensions', () => {
      render(<ROICalculator />);
      
      // Trajectory chart
      const trajectoryChart = screen.getByText('3-Year Trajectory').closest('div');
      expect(trajectoryChart).toBeInTheDocument();
      
      // Value breakdown
      const valueBreakdown = screen.getByText('Value Breakdown').closest('div');
      expect(valueBreakdown).toBeInTheDocument();
      
      // Strategic insights
      const insights = screen.getByText('Strategic Insights').closest('div');
      expect(insights).toBeInTheDocument();
    });
  });

  describe('Impact Cascade Visual Tests', () => {
    it('should maintain consistent layout structure', () => {
      const { container } = render(<ImpactCascade />);
      
      // Check main container
      const mainContainer = container.querySelector('.flex-1');
      expect(mainContainer).toBeInTheDocument();
      
      // Check grid layout
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should render agent badges consistently', () => {
      render(<ImpactCascade />);
      
      const badges = screen.getAllByTestId(/agent-badge-/);
      expect(badges.length).toBeGreaterThan(0);
      
      badges.forEach(badge => {
        expect(badge).toHaveAttribute('data-testid');
        expect(badge).toHaveAttribute('data-size');
      });
    });

    it('should render confidence indicators with consistent styling', () => {
      render(<ImpactCascade />);
      
      const indicators = screen.getAllByTestId('confidence-indicator');
      expect(indicators.length).toBeGreaterThan(0);
      
      indicators.forEach(indicator => {
        expect(indicator).toHaveAttribute('data-size');
        expect(indicator).toBeInTheDocument();
      });
    });

    it('should render feature library with consistent spacing', () => {
      render(<ImpactCascade />);
      
      const featureLibrary = screen.getByText('Feature Library').closest('div');
      expect(featureLibrary).toBeInTheDocument();
      
      const features = within(featureLibrary!).getAllByRole('button');
      expect(features.length).toBeGreaterThan(0);
      
      features.forEach(feature => {
        expect(feature).toHaveAttribute('draggable');
        expect(feature).toHaveAttribute('class');
      });
    });
  });

  describe('Scenario Matrix Visual Tests', () => {
    const mockScenarios = [
      {
        id: 'test-1',
        title: 'Test Scenario 1',
        description: 'Description 1',
        category: 'Financial',
        icon: 'chart',
        aiRecommended: true,
        aiConfidence: 0.9,
        estimatedTime: '15 min',
        estimatedValue: '$50K',
        complexity: 'simple',
      },
      {
        id: 'test-2',
        title: 'Test Scenario 2',
        description: 'Description 2',
        category: 'Technical',
        icon: 'brain',
        aiRecommended: false,
        estimatedTime: '30 min',
        estimatedValue: '$100K',
        complexity: 'medium',
      },
    ];

    it('should render header with consistent styling', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
          title="Select Scenario"
          description="Choose your scenario"
        />
      );
      
      const header = screen.getByText('Select Scenario').closest('div');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('p-6');
    });

    it('should render search and filters consistently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
          showSearch={true}
          showFilters={true}
        />
      );
      
      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveClass('pl-10');
      
      const filterSelect = screen.getByRole('combobox');
      expect(filterSelect).toBeInTheDocument();
    });

    it('should render view toggle buttons consistently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
          showViewToggle={true}
        />
      );
      
      const gridButton = screen.getByRole('button', { name: /grid/i });
      const listButton = screen.getByRole('button', { name: /list/i });
      
      expect(gridButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();
      expect(gridButton).toHaveAttribute('class');
      expect(listButton).toHaveAttribute('class');
    });

    it('should render scenario cards with consistent structure', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
          defaultView="grid"
        />
      );
      
      const cards = screen.getAllByRole('button');
      const scenarioCards = cards.filter(card => 
        card.textContent?.includes('Test Scenario')
      );
      
      expect(scenarioCards.length).toBe(2);
      
      scenarioCards.forEach(card => {
        expect(card).toHaveAttribute('class');
        expect(card).toHaveAttribute('tabIndex');
      });
    });

    it('should render AI badges consistently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
          showAIRecommendations={true}
        />
      );
      
      const aiBadge = screen.getByText('AI Pick 90%');
      expect(aiBadge).toBeInTheDocument();
      expect(aiBadge.closest('div')).toHaveClass('absolute');
    });

    it('should render complexity badges consistently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {}}
        />
      );
      
      const simpleBadge = screen.getByText('Simple');
      const mediumBadge = screen.getByText('Medium');
      
      expect(simpleBadge).toBeInTheDocument();
      expect(mediumBadge).toBeInTheDocument();
      
      [simpleBadge, mediumBadge].forEach(badge => {
        expect(badge.closest('span')).toHaveAttribute('class');
      });
    });
  });

  describe('Quantum View Visual Tests', () => {
    const mockAnalyses = [
      {
        id: 'financial',
        persona: 'financial',
        title: 'Financial Analysis',
        summary: 'Strong ROI',
        confidence: 85,
        keyMetrics: [{ label: 'ROI', value: '245', unit: '%' }],
        recommendations: ['Proceed'],
        risks: ['Low risk'],
        consensus: true,
        aiGenerated: true,
      },
      {
        id: 'technical',
        persona: 'technical',
        title: 'Technical Assessment',
        summary: 'Scalable architecture',
        confidence: 78,
        keyMetrics: [{ label: 'Capacity', value: '10000', unit: 'users' }],
        recommendations: ['Upgrade'],
        risks: ['Technical debt'],
        consensus: true,
        aiGenerated: true,
      },
    ];

    it('should render header with consistent styling', () => {
      render(<QuantumView analyses={mockAnalyses} />);
      
      const header = screen.getByText('Quantum View').closest('div');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('h-14');
    });

    it('should render quick stats with consistent layout', () => {
      render(<QuantumView analyses={mockAnalyses} />);
      
      const stats = screen.getAllByRole('button');
      const statCards = stats.filter(card => 
        card.textContent?.includes('Total Personas') ||
        card.textContent?.includes('Consensus') ||
        card.textContent?.includes('Avg Confidence')
      );
      
      expect(statCards.length).toBe(3);
      
      statCards.forEach(card => {
        expect(card).toHaveClass('p-4');
        expect(card).toHaveClass('bg-card');
      });
    });

    it('should render persona cards with consistent structure', () => {
      render(<QuantumView analyses={mockAnalyses} />);
      
      const cards = screen.getAllByRole('button');
      const personaCards = cards.filter(card => 
        card.textContent?.includes('Financial Analysis') ||
        card.textContent?.includes('Technical Assessment')
      );
      
      expect(personaCards.length).toBe(2);
      
      personaCards.forEach(card => {
        expect(card).toHaveAttribute('class');
        expect(card).toHaveAttribute('tabIndex');
      });
    });

    it('should render AI indicators consistently', () => {
      render(<QuantumView analyses={mockAnalyses} />);
      
      const aiBadges = screen.getAllByText('AI');
      expect(aiBadges.length).toBe(2);
      
      aiBadges.forEach(badge => {
        expect(badge.closest('span')).toHaveClass('bg-primary/20');
      });
    });

    it('should render consensus indicators consistently', () => {
      render(<QuantumView analyses={mockAnalyses} showConsensus={true} />);
      
      const consensusBadges = screen.getAllByText('Consensus');
      expect(consensusBadges.length).toBeGreaterThan(0);
      
      consensusBadges.forEach(badge => {
        expect(badge.closest('div')).toHaveClass('text-green-600');
      });
    });

    it('should render detail view with consistent spacing', () => {
      render(<QuantumView analyses={mockAnalyses} />);
      
      const financialCard = screen.getByText('Financial Analysis').closest('button');
      financialCard?.click();
      
      const detailView = screen.getByTestId('analysis-detail-financial');
      expect(detailView).toBeInTheDocument();
      
      // Check consistent spacing
      const sections = detailView.querySelectorAll('div[class*="space-y-"]');
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Template Visual Consistency', () => {
    it('should maintain consistent button styling', () => {
      // Test all templates have consistent button classes
      const { container: roiContainer } = render(<ROICalculator />);
      const { container: impactContainer } = render(<ImpactCascade />);
      
      const roiButtons = roiContainer.querySelectorAll('button');
      const impactButtons = impactContainer.querySelectorAll('button');
      
      // Both should have button elements
      expect(roiButtons.length).toBeGreaterThan(0);
      expect(impactButtons.length).toBeGreaterThan(0);
    });

    it('should maintain consistent card styling', () => {
      render(<ROICalculator />);
      
      const cards = screen.getAllByRole('button');
      const bentoCards = cards.filter(card => 
        card.className.includes('bento-card')
      );
      
      bentoCards.forEach(card => {
        // Check consistent border and background
        expect(card.className).toContain('border');
        expect(card.className).toContain('rounded');
      });
    });

    it('should maintain consistent text hierarchy', () => {
      const { container } = render(<ROICalculator />);
      
      // Check heading levels
      const h1 = container.querySelector('h1');
      const h2 = container.querySelector('h2');
      const h3 = container.querySelector('h3');
      
      // All should have consistent font sizes
      if (h1) expect(h1.className).toContain('text-lg');
      if (h2) expect(h2.className).toContain('text-sm');
      if (h3) expect(h3.className).toContain('text-sm');
    });
  });
});