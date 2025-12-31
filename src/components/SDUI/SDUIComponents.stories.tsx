import type { Meta, StoryObj } from '@storybook/react';
import { DiscoveryCard, ExpansionBlock, InfoBanner, ValueTreeCard } from './index';

const meta: Meta = {
  title: 'SDUI/Components',
  component: InfoBanner,
};

export default meta;

type Story = StoryObj<typeof InfoBanner>;

export const Banner: Story = {
  name: 'InfoBanner',
  args: {
    title: 'Opportunity Overview',
    description: 'High-level summary',
    tone: 'info',
  },
};

export const Discovery: StoryObj<typeof DiscoveryCard> = {
  render: (args) => <DiscoveryCard {...args} />,
  args: {
    title: 'Discovery Questions',
    questions: ['KPI?', 'Goal?'],
    prompt: 'Use this to shape the opportunity brief.',
  },
};

export const ValueTree: StoryObj<typeof ValueTreeCard> = {
  render: (args) => <ValueTreeCard {...args} />,
  args: {
    title: 'Target Outcomes',
    nodes: ['Reduce Cost', 'Increase Revenue'],
  },
};

export const Expansion: StoryObj<typeof ExpansionBlock> = {
  render: (args) => <ExpansionBlock {...args} />,
  args: {
    label: 'Expansion Model',
    gaps: ['Feature Gap A'],
    roi: { revenue: 10000, cost: 2000 },
  },
};
