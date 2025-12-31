/**
 * ScenarioSelector Storybook Stories
 * Install @storybook/react to use these stories
 */

// @ts-ignore - Storybook types not installed
import type { Meta, StoryObj } from '@storybook/react';
import { ScenarioSelector } from './ScenarioSelector';

const meta: Meta<typeof ScenarioSelector> = {
  title: 'SDUI/ScenarioSelector',
  component: ScenarioSelector,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    onSelect: { action: 'selected' },
    onMultiSelect: { action: 'multi-selected' },
    onPreview: { action: 'preview' },
  },
};

export default meta;
type Story = StoryObj<typeof ScenarioSelector>;

const mockScenarios = [
  {
    id: 'revenue-growth',
    title: 'Revenue Growth Optimization',
    description: 'Identify and capitalize on revenue growth opportunities through data-driven analysis and targeted initiatives.',
    category: 'Growth',
    icon: 'trending' as const,
    aiRecommended: true,
    aiConfidence: 0.92,
    aiReasoning: 'Based on your current metrics, this scenario shows the highest potential ROI.',
    complexity: 'medium' as const,
    estimatedTime: '2-3 weeks',
    estimatedValue: '$250K-500K',
    tags: ['revenue', 'growth', 'optimization'],
  },
  {
    id: 'cost-reduction',
    title: 'Operational Cost Reduction',
    description: 'Streamline operations and reduce costs through process optimization and automation.',
    category: 'Efficiency',
    icon: 'zap' as const,
    complexity: 'simple' as const,
    estimatedTime: '1-2 weeks',
    estimatedValue: '$100K-200K',
    tags: ['cost', 'efficiency', 'automation'],
  },
  {
    id: 'customer-retention',
    title: 'Customer Retention Program',
    description: 'Build a comprehensive retention strategy to reduce churn and increase lifetime value.',
    category: 'Growth',
    icon: 'users' as const,
    complexity: 'complex' as const,
    estimatedTime: '4-6 weeks',
    estimatedValue: '$500K+',
    tags: ['customer', 'retention', 'loyalty'],
  },
  {
    id: 'market-expansion',
    title: 'New Market Expansion',
    description: 'Evaluate and enter new market segments with minimized risk and maximized potential.',
    category: 'Strategy',
    icon: 'target' as const,
    complexity: 'complex' as const,
    estimatedTime: '6-8 weeks',
    estimatedValue: '$1M+',
    tags: ['market', 'expansion', 'strategy'],
  },
  {
    id: 'product-launch',
    title: 'Product Launch Assessment',
    description: 'Evaluate new product viability and create go-to-market strategy.',
    category: 'Strategy',
    icon: 'star' as const,
    complexity: 'medium' as const,
    estimatedTime: '3-4 weeks',
    estimatedValue: '$300K-600K',
    tags: ['product', 'launch', 'gtm'],
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment & Mitigation',
    description: 'Identify and mitigate business risks through comprehensive analysis.',
    category: 'Risk',
    icon: 'shield' as const,
    complexity: 'medium' as const,
    estimatedTime: '2-3 weeks',
    tags: ['risk', 'compliance', 'mitigation'],
  },
];

// Default grid view
export const Default: Story = {
  args: {
    title: 'Select a Value Scenario',
    description: 'Choose the scenario that best matches your business objectives',
    scenarios: mockScenarios,
    showAIRecommendations: true,
    showSearch: true,
    showFilters: true,
    showViewToggle: true,
    columns: 2,
  },
};

// With preview images
export const WithPreviewImages: Story = {
  args: {
    title: 'Templates with Previews',
    scenarios: mockScenarios.map((s) => ({
      ...s,
      previewImage: `https://picsum.photos/seed/${s.id}/400/200`,
    })),
    showAIRecommendations: true,
    columns: 3,
  },
};

// List view
export const ListView: Story = {
  args: {
    title: 'Scenario List',
    scenarios: mockScenarios,
    defaultView: 'list',
    showViewToggle: true,
  },
};

// Multi-select mode
export const MultiSelect: Story = {
  args: {
    title: 'Select Multiple Scenarios',
    description: 'You can select multiple scenarios to compare',
    scenarios: mockScenarios,
    multiSelect: true,
    selectedIds: ['revenue-growth', 'cost-reduction'],
  },
};

// Without AI recommendations
export const NoAIRecommendations: Story = {
  args: {
    title: 'Available Scenarios',
    scenarios: mockScenarios,
    showAIRecommendations: false,
  },
};

// Single column layout
export const SingleColumn: Story = {
  args: {
    title: 'Scenarios',
    scenarios: mockScenarios.slice(0, 3),
    columns: 1,
    showSearch: false,
    showFilters: false,
    showViewToggle: false,
  },
};

// With max height and scroll
export const WithScroll: Story = {
  args: {
    title: 'Scrollable Scenarios',
    scenarios: mockScenarios,
    maxHeight: '400px',
    columns: 2,
  },
};

// Pre-selected scenario
export const Preselected: Story = {
  args: {
    title: 'Continue with Selected Scenario',
    scenarios: mockScenarios,
    selectedId: 'revenue-growth',
  },
};

// Minimal UI
export const Minimal: Story = {
  args: {
    scenarios: mockScenarios.slice(0, 4),
    showSearch: false,
    showFilters: false,
    showViewToggle: false,
    showAIRecommendations: false,
    columns: 2,
  },
};

// Empty state
export const Empty: Story = {
  args: {
    title: 'Available Scenarios',
    description: 'No scenarios match your criteria',
    scenarios: [],
    showSearch: true,
  },
};
