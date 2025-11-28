/**
 * ScenarioSelector Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScenarioSelector, Scenario } from '../ScenarioSelector';

describe('ScenarioSelector', () => {
  const mockOnSelect = vi.fn();
  const mockOnMultiSelect = vi.fn();

  const mockScenarios: Scenario[] = [
    {
      id: 'scenario-1',
      title: 'Revenue Growth',
      description: 'Increase revenue through optimization',
      category: 'Growth',
      aiRecommended: true,
      aiConfidence: 0.92,
      complexity: 'medium',
      estimatedTime: '2-3 weeks',
      tags: ['revenue', 'growth'],
    },
    {
      id: 'scenario-2',
      title: 'Cost Reduction',
      description: 'Reduce operational costs',
      category: 'Efficiency',
      complexity: 'simple',
      estimatedTime: '1 week',
      tags: ['cost', 'efficiency'],
    },
    {
      id: 'scenario-3',
      title: 'Customer Retention',
      description: 'Improve customer retention rates',
      category: 'Growth',
      complexity: 'complex',
      estimatedTime: '4-6 weeks',
      tags: ['customer', 'retention'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders title and description', () => {
      render(
        <ScenarioSelector
          title="Select a Scenario"
          description="Choose the best scenario for your use case"
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Select a Scenario')).toBeInTheDocument();
      expect(screen.getByText('Choose the best scenario for your use case')).toBeInTheDocument();
    });

    it('renders all scenarios', () => {
      render(
        <ScenarioSelector scenarios={mockScenarios} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('Revenue Growth')).toBeInTheDocument();
      expect(screen.getByText('Cost Reduction')).toBeInTheDocument();
      expect(screen.getByText('Customer Retention')).toBeInTheDocument();
    });

    it('shows AI recommendation badge', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      expect(screen.getByText(/AI Pick 92%/)).toBeInTheDocument();
    });

    it('shows complexity badges', () => {
      render(
        <ScenarioSelector scenarios={mockScenarios} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('Simple')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Complex')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('calls onSelect when scenario is clicked', () => {
      render(
        <ScenarioSelector scenarios={mockScenarios} onSelect={mockOnSelect} />
      );

      fireEvent.click(screen.getByText('Cost Reduction'));

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'scenario-2', title: 'Cost Reduction' })
      );
    });

    it('shows selected state', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          selectedId="scenario-1"
        />
      );

      // The selected scenario should have visual indication
      const selectedCard = screen.getByText('Revenue Growth').closest('button');
      expect(selectedCard).toHaveClass('border-[#39FF14]');
    });

    it('supports multi-select mode', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          onMultiSelect={mockOnMultiSelect}
          multiSelect={true}
        />
      );

      fireEvent.click(screen.getByText('Revenue Growth'));
      fireEvent.click(screen.getByText('Cost Reduction'));

      expect(mockOnMultiSelect).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'scenario-1' }),
          expect.objectContaining({ id: 'scenario-2' }),
        ])
      );
    });

    it('shows selection count in multi-select mode', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          onMultiSelect={mockOnMultiSelect}
          multiSelect={true}
          selectedIds={['scenario-1', 'scenario-2']}
        />
      );

      expect(screen.getByText('2 scenarios selected')).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters scenarios by search query', async () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      fireEvent.change(searchInput, { target: { value: 'revenue' } });

      await waitFor(() => {
        expect(screen.getByText('Revenue Growth')).toBeInTheDocument();
        expect(screen.queryByText('Cost Reduction')).not.toBeInTheDocument();
        expect(screen.queryByText('Customer Retention')).not.toBeInTheDocument();
      });
    });

    it('filters by category', async () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showFilters={true}
        />
      );

      const categorySelect = screen.getByRole('combobox');
      fireEvent.change(categorySelect, { target: { value: 'Growth' } });

      await waitFor(() => {
        expect(screen.getByText('Revenue Growth')).toBeInTheDocument();
        expect(screen.getByText('Customer Retention')).toBeInTheDocument();
        expect(screen.queryByText('Cost Reduction')).not.toBeInTheDocument();
      });
    });

    it('shows empty state when no results', async () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search scenarios...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No scenarios found')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('toggles between grid and list view', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showViewToggle={true}
        />
      );

      // Should start in grid view by default
      const gridButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg.lucide-grid')
      );
      const listButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg.lucide-list')
      );

      expect(gridButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();

      // Click list view
      if (listButton) {
        fireEvent.click(listButton);
      }

      // View should change (visual difference in layout)
    });

    it('respects defaultView prop', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showViewToggle={true}
          defaultView="list"
        />
      );

      // List view should be active
      const listButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg.lucide-list')
      );
      expect(listButton).toHaveClass('bg-[#39FF14]');
    });
  });

  describe('AI Recommendations', () => {
    it('sorts AI recommended scenarios first', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={true}
        />
      );

      const cards = screen.getAllByRole('button');
      // First card should be the AI recommended one
      expect(cards[0]).toHaveTextContent('Revenue Growth');
    });

    it('hides AI badges when showAIRecommendations is false', () => {
      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
          showAIRecommendations={false}
        />
      );

      expect(screen.queryByText(/AI Pick/)).not.toBeInTheDocument();
    });
  });
});
