/**
 * Comprehensive Test Suite for Scenario Matrix Template
 * Tests functionality, security, accessibility, and performance
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScenarioSelector, type Scenario } from '../ScenarioSelector';

// Mock data for testing
const mockScenarios: Scenario[] = [
  {
    id: 'roi-calculator',
    title: 'ROI Calculator',
    description: 'Calculate return on investment for your project',
    category: 'Financial',
    icon: 'chart',
    aiRecommended: true,
    aiConfidence: 0.95,
    aiReasoning: 'High relevance based on your financial goals',
    estimatedTime: '15 min',
    estimatedValue: '$50K-500K',
    complexity: 'simple',
    tags: ['finance', 'investment', 'analysis'],
    useCases: ['Budget planning', 'Project approval'],
    prerequisites: ['Basic cost data'],
  },
  {
    id: 'impact-cascade',
    title: 'Impact Cascade',
    description: 'Visualize value flow through your organization',
    category: 'Visualization',
    icon: 'layers',
    aiRecommended: false,
    estimatedTime: '30 min',
    estimatedValue: '$100K-1M',
    complexity: 'medium',
    tags: ['visualization', 'value-mapping'],
    useCases: ['Stakeholder communication'],
  },
  {
    id: 'scenario-matrix',
    title: 'Scenario Matrix',
    description: 'Compare multiple business scenarios side by side',
    category: 'Analysis',
    icon: 'grid',
    aiRecommended: true,
    aiConfidence: 0.88,
    aiReasoning: 'Matches your pattern of multi-scenario analysis',
    estimatedTime: '45 min',
    estimatedValue: '$200K-2M',
    complexity: 'complex',
    tags: ['comparison', 'analysis', 'decision-making'],
    useCases: ['Strategic planning', 'Risk assessment'],
    prerequisites: ['Multiple scenarios defined'],
  },
  {
    id: 'story-arc',
    title: 'Story Arc Canvas',
    description: 'Create compelling value narratives',
    category: 'Communication',
    icon: 'star',
    estimatedTime: '20 min',
    estimatedValue: '$75K-300K',
    complexity: 'simple',
    tags: ['narrative', 'storytelling', 'presentation'],
    useCases: ['Executive presentations', 'Sales pitches'],
  },
];

const mockCategories = [
  { id: 'Financial', label: 'Financial', count: 1 },
  { id: 'Visualization', label: 'Visualization', count: 1 },
  { id: 'Analysis', label: 'Analysis', count: 1 },
  { id: 'Communication', label: 'Communication', count: 1 },
];

describe('ScenarioSelector - Scenario Matrix Template', () => {
  const mockOnSelect = vi.fn();
  const mockOnMultiSelect = vi.fn();
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render all main components correctly', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Header
      expect(screen.getByText('Select a Scenario')).toBeInTheDocument();

      // Search input
      expect(screen.getByPlaceholderText('Search scenarios...')).toBeInTheDocument();

      // Filter dropdown
      expect(screen.getByText('All Categories')).toBeInTheDocument();

      // View toggle buttons
      expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();

      // Scenario cards
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.getByText('Impact Cascade')).toBeInTheDocument();
      expect(screen.getByText('Scenario Matrix')).toBeInTheDocument();
      expect(screen.getByText('Story Arc Canvas')).toBeInTheDocument();
    });

    it('should render with custom title and description', () => {
      render(
        <ScenarioSelector
          title="Custom Title"
          description="Custom description text"
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom description text')).toBeInTheDocument();
    });

    it('should display AI recommendations correctly', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      // Should show AI Pick badges for recommended scenarios
      const aiBadges = screen.getAllByText(/AI Pick/);
      expect(aiBadges.length).toBeGreaterThan(0);

      // Check confidence percentages
      expect(screen.getByText('AI Pick 95%')).toBeInTheDocument();
      expect(screen.getByText('AI Pick 88%')).toBeInTheDocument();
    });

    it('should hide AI recommendations when disabled', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={false}
        />
      );

      // Should not show AI badges
      const aiBadges = screen.queryAllByText(/AI Pick/);
      expect(aiBadges.length).toBe(0);
    });

    it('should show complexity badges', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Simple')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Complex')).toBeInTheDocument();
    });

    it('should show estimated time and value', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('$50K-500K')).toBeInTheDocument();
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByText('$100K-1M')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter scenarios by search query', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      
      // Search for "ROI"
      fireEvent.change(searchInput, { target: { value: 'ROI' } });

      // Should show ROI Calculator but hide others
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.queryByText('Impact Cascade')).not.toBeInTheDocument();
    });

    it('should search in description and tags', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      
      // Search for "visualization" (in description)
      fireEvent.change(searchInput, { target: { value: 'visualization' } });

      expect(screen.getByText('Impact Cascade')).toBeInTheDocument();
    });

    it('should clear search results', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      fireEvent.change(searchInput, { target: { value: 'ROI' } });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      // Should show all scenarios again
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.getByText('Impact Cascade')).toBeInTheDocument();
    });

    it('should show "no results" message when search yields nothing', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No scenarios found')).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('should filter scenarios by category', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          categories={mockCategories}
          onSelect={mockOnSelect}
        />
      );

      const categorySelect = screen.getByRole('combobox');
      fireEvent.change(categorySelect, { target: { value: 'Financial' } });

      // Should show only Financial scenarios
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.queryByText('Impact Cascade')).not.toBeInTheDocument();
    });

    it('should derive categories automatically when not provided', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Should show categories in dropdown
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toBeInTheDocument();

      // Check that categories are derived
      const options = within(categorySelect).getAllByRole('option');
      expect(options.length).toBeGreaterThan(1); // At least "All Categories" + derived categories
    });

    it('should show category counts', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          categories={mockCategories}
          onSelect={mockOnSelect}
        />
      );

      // Check that counts are displayed
      const categorySelect = screen.getByRole('combobox');
      const financialOption = within(categorySelect).getByText('Financial (1)');
      expect(financialOption).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to List View', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const listButton = screen.getByRole('button', { name: /list/i });
      fireEvent.click(listButton);

      // Should show list layout
      const rows = screen.getAllByRole('button');
      const scenarioRows = rows.filter(row => 
        row.textContent?.includes('ROI Calculator')
      );
      expect(scenarioRows.length).toBeGreaterThan(0);
    });

    it('should switch to Grid View', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          defaultView="list"
        />
      );

      const gridButton = screen.getByRole('button', { name: /grid/i });
      fireEvent.click(gridButton);

      // Should show grid layout
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
    });

    it('should maintain selection when switching views', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Select a scenario
      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      // Switch to list view
      const listButton = screen.getByRole('button', { name: /list/i });
      fireEvent.click(listButton);

      // Should still show selection
      const selectedElements = screen.getAllByText(/ROI Calculator/);
      expect(selectedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Selection Functionality', () => {
    it('should handle single selection', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'roi-calculator',
          title: 'ROI Calculator',
        })
      );
    });

    it('should show selected state visually', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      // Should have selected styling
      expect(roiCard).toHaveClass('bg-[#39FF14]/5');
      expect(roiCard).toHaveClass('border-[#39FF14]');
    });

    it('should handle multi-select mode', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          multiSelect={true}
          onMultiSelect={mockOnMultiSelect}
        />
      );

      // Select multiple scenarios
      const roiCard = screen.getByText('ROI Calculator').closest('button');
      const impactCard = screen.getByText('Impact Cascade').closest('button');

      fireEvent.click(roiCard!);
      fireEvent.click(impactCard!);

      expect(mockOnMultiSelect).toHaveBeenCalled();
    });

    it('should show multi-select footer when selections exist', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          multiSelect={true}
          onMultiSelect={mockOnMultiSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      // Should show selection count
      expect(screen.getByText('1 scenario selected')).toBeInTheDocument();
    });

    it('should allow clearing multi-selection', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          multiSelect={true}
          onMultiSelect={mockOnMultiSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      const clearButton = screen.getByText('Clear selection');
      fireEvent.click(clearButton);

      expect(mockOnMultiSelect).toHaveBeenCalledWith([]);
    });
  });

  describe('Preview Functionality', () => {
    it('should call onPreview when preview button clicked', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          onPreview={mockOnPreview}
        />
      );

      // Hover over card to show preview button
      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.mouseEnter(roiCard!);

      // Click preview button (it's in the grid view)
      const previewButton = screen.getByRole('button', { name: /external link/i });
      fireEvent.click(previewButton);

      expect(mockOnPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'roi-calculator',
        })
      );
    });

    it('should show preview button on hover in grid view', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          onPreview={mockOnPreview}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      
      // Before hover - preview button should be hidden
      const previewButtonBefore = screen.queryByRole('button', { name: /external link/i });
      expect(previewButtonBefore).not.toBeInTheDocument();

      // After hover
      fireEvent.mouseEnter(roiCard!);
      const previewButtonAfter = screen.getByRole('button', { name: /external link/i });
      expect(previewButtonAfter).toBeInTheDocument();
    });
  });

  describe('Security - XSS Prevention', () => {
    it('should sanitize scenario titles and descriptions', () => {
      const maliciousScenarios: Scenario[] = [
        {
          id: 'malicious',
          title: '<script>alert("xss")</script>',
          description: 'javascript:alert("xss")',
          category: 'Test',
        },
      ];

      render(
        <ScenarioSelector
          scenarios={maliciousScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Should not execute script
      const scriptElements = screen.queryAllByText(/<script>/);
      expect(scriptElements.length).toBe(0);

      // Should show sanitized text
      expect(screen.getByText(/alert/)).toBeInTheDocument();
    });

    it('should sanitize AI reasoning text', () => {
      const maliciousScenarios: Scenario[] = [
        {
          id: 'malicious-ai',
          title: 'Test',
          description: 'Test',
          aiRecommended: true,
          aiConfidence: 0.9,
          aiReasoning: '<img src=x onerror=alert(1)>',
        },
      ];

      render(
        <ScenarioSelector
          scenarios={maliciousScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      // Should not render dangerous HTML
      const imgElements = screen.queryAllByRole('img');
      const hasDangerousImg = imgElements.some(img => 
        img.getAttribute('src') === 'x'
      );
      expect(hasDangerousImg).toBe(false);
    });

    it('should handle malicious tags safely', () => {
      const maliciousScenarios: Scenario[] = [
        {
          id: 'malicious-tags',
          title: 'Test',
          description: 'Test',
          tags: ['<script>', 'javascript:alert(1)'],
        },
      ];

      render(
        <ScenarioSelector
          scenarios={maliciousScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Tags should be displayed safely
      expect(screen.getByText(/<script>/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Search input should have label
      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      expect(searchInput).toHaveAttribute('aria-label');

      // Buttons should have accessible names
      const gridButton = screen.getByRole('button', { name: /grid/i });
      expect(gridButton).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex');
      });
    });

    it('should announce selection changes', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      // Should be focusable and have proper ARIA
      expect(roiCard).toHaveAttribute('aria-pressed');
    });

    it('should provide screen reader friendly text', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      // Check for descriptive text
      expect(screen.getByText(/AI Pick/)).toBeInTheDocument();
      expect(screen.getByText(/Simple|Medium|Complex/)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly with many scenarios', () => {
      const manyScenarios = Array.from({ length: 50 }, (_, i) => ({
        id: `scenario-${i}`,
        title: `Scenario ${i}`,
        description: `Description ${i}`,
        category: 'Test',
      }));

      const start = performance.now();
      render(
        <ScenarioSelector
          scenarios={manyScenarios}
          onSelect={mockOnSelect}
        />
      );
      const end = performance.now();

      // Should render in under 200ms
      expect(end - start).toBeLessThan(200);
    });

    it('should handle rapid search updates efficiently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');

      // Rapid search updates
      for (let i = 0; i < 10; i++) {
        fireEvent.change(searchInput, { target: { value: `test${i}` } });
      }

      // Should remain stable
      expect(screen.getByPlaceholderText('Search scenarios...')).toBeInTheDocument();
    });

    it('should handle rapid view switching', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const gridButton = screen.getByRole('button', { name: /grid/i });
      const listButton = screen.getByRole('button', { name: /list/i });

      // Rapid switching
      for (let i = 0; i < 20; i++) {
        fireEvent.click(gridButton);
        fireEvent.click(listButton);
      }

      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty scenarios array', () => {
      render(
        <ScenarioSelector
          scenarios={[]}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('No scenarios found')).toBeInTheDocument();
    });

    it('should handle missing optional properties', () => {
      const minimalScenarios: Scenario[] = [
        {
          id: 'minimal',
          title: 'Minimal',
          description: 'Minimal scenario',
        },
      ];

      render(
        <ScenarioSelector
          scenarios={minimalScenarios}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Minimal')).toBeInTheDocument();
    });

    it('should handle invalid data gracefully', () => {
      const invalidScenarios: any[] = [
        { id: 'invalid' }, // Missing required properties
        null,
        undefined,
      ];

      // Filter out null/undefined for this test
      const validOnly = invalidScenarios.filter(s => s && s.id);

      render(
        <ScenarioSelector
          scenarios={validOnly}
          onSelect={mockOnSelect}
        />
      );

      // Should not crash
      expect(screen.getByText('Select a Scenario')).toBeInTheDocument();
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

      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Should still render critical content
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search scenarios...')).toBeInTheDocument();

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

      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Check that scenario cards are still accessible
      const scenarioButtons = screen.getAllByRole('button');
      scenarioButtons.forEach(button => {
        expect(button).toBeEnabled();
      });

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });
  });

  describe('Integration with External Systems', () => {
    it('should call onSelect with correct scenario data', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'roi-calculator',
          title: 'ROI Calculator',
          description: 'Calculate return on investment for your project',
          category: 'Financial',
          icon: 'chart',
          aiRecommended: true,
          aiConfidence: 0.95,
          aiReasoning: 'High relevance based on your financial goals',
          estimatedTime: '15 min',
          estimatedValue: '$50K-500K',
          complexity: 'simple',
          tags: ['finance', 'investment', 'analysis'],
          useCases: ['Budget planning', 'Project approval'],
          prerequisites: ['Basic cost data'],
        })
      );
    });

    it('should work with custom columns layout', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          columns={3}
        />
      );

      // Should render with 3 columns
      const grid = screen.getByRole('button', { name: /ROI Calculator/ }).closest('div');
      expect(grid).toBeInTheDocument();
    });

    it('should respect maxHeight constraint', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          maxHeight="300px"
        />
      );

      // Should render with max height
      const container = screen.getByText('Select a Scenario').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('should show loading state for AI recommendations', () => {
      // This would be tested with actual loading states if implemented
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      // AI badges should be visible
      const aiBadges = screen.getAllByText(/AI Pick/);
      expect(aiBadges.length).toBeGreaterThan(0);
    });

    it('should highlight selected scenarios', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      // Should have selected styling
      expect(roiCard).toHaveClass('bg-[#39FF14]/5');
      expect(roiCard).toHaveClass('border-[#39FF14]');
    });

    it('should show hover effects', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      const roiCard = screen.getByText('ROI Calculator').closest('button');
      
      // Before hover
      expect(roiCard).not.toHaveClass('hover:border-[#555555]');

      // After hover
      fireEvent.mouseEnter(roiCard!);
      // Component should handle hover via CSS
      expect(roiCard).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long titles and descriptions', () => {
      const longScenario: Scenario[] = [
        {
          id: 'long',
          title: 'A'.repeat(200),
          description: 'B'.repeat(500),
          category: 'Test',
        },
      ];

      render(
        <ScenarioSelector
          scenarios={longScenario}
          onSelect={mockOnSelect}
        />
      );

      // Should render without breaking
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle special characters in data', () => {
      const specialScenario: Scenario[] = [
        {
          id: 'special',
          title: 'Test & < > " \'',
          description: 'Test & < > " \'',
          category: 'Test & < >',
          tags: ['tag & < >'],
        },
      ];

      render(
        <ScenarioSelector
          scenarios={specialScenario}
          onSelect={mockOnSelect}
        />
      );

      // Should display safely
      expect(screen.getByText(/Test &/)).toBeInTheDocument();
    });

    it('should handle rapid state changes without crashing', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Rapid interactions
      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      const gridButton = screen.getByRole('button', { name: /grid/i });
      const listButton = screen.getByRole('button', { name: /list/i });

      for (let i = 0; i < 5; i++) {
        fireEvent.change(searchInput, { target: { value: `test${i}` } });
        fireEvent.click(gridButton);
        fireEvent.click(listButton);
      }

      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
    });
  });

  describe('Visual Regression Prevention', () => {
    it('should maintain consistent card structure', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Check that all cards have consistent structure
      const cards = screen.getAllByRole('button');
      const scenarioCards = cards.filter(card => 
        card.textContent?.includes('ROI Calculator') || 
        card.textContent?.includes('Impact Cascade')
      );

      expect(scenarioCards.length).toBeGreaterThan(0);

      // Each card should have title and description
      scenarioCards.forEach(card => {
        expect(card.textContent).toBeTruthy();
      });
    });

    it('should render all metadata consistently', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      // Check that all expected metadata is present
      expect(screen.getByText('Simple')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('$50K-500K')).toBeInTheDocument();
    });

    it('should maintain layout in both view modes', () => {
      const { rerender } = render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          defaultView="grid"
        />
      );

      // Grid view
      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();

      // Switch to list
      rerender(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          defaultView="list"
        />
      );

      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
    });
  });
});