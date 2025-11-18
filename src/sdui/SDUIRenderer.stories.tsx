import type { Meta, StoryObj } from '@storybook/react';
import { SDUIRenderer } from './renderer';
import { OpportunityTemplate, TargetTemplate, ExpansionTemplate, IntegrityTemplate } from './templates';

const meta: Meta<typeof SDUIRenderer> = {
  title: 'SDUI/Renderer',
  component: SDUIRenderer,
};

export default meta;

type Story = StoryObj<typeof SDUIRenderer>;

export const Opportunity: Story = {
  args: {
    schema: OpportunityTemplate,
  },
};

export const Target: Story = {
  args: {
    schema: TargetTemplate,
  },
};

export const Expansion: Story = {
  args: {
    schema: ExpansionTemplate,
  },
};

export const Integrity: Story = {
  args: {
    schema: IntegrityTemplate,
    debugOverlay: true,
  },
};
