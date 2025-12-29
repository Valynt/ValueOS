/**
 * Card Component Storybook Stories
 */

import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Atoms/Card",
  component: Card,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Reusable card wrapper with consistent styling, variants, and optional header/footer slots.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "bordered", "elevated"],
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2">Card Title</h3>
        <p className="text-muted-foreground">
          This is a default card with standard styling.
        </p>
      </div>
    ),
  },
};

export const Bordered: Story = {
  args: {
    variant: "bordered",
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2">Bordered Card</h3>
        <p className="text-muted-foreground">
          This card has a thicker border for emphasis.
        </p>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: "elevated",
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2">Elevated Card</h3>
        <p className="text-muted-foreground">
          This card has a shadow for a lifted appearance.
        </p>
      </div>
    ),
  },
};

export const WithHeader: Story = {
  args: {
    header: (
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Card Header</h3>
        <button className="text-sm text-primary">Action</button>
      </div>
    ),
    children: (
      <p className="text-muted-foreground">
        Content goes here with a header above.
      </p>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    children: (
      <p className="text-muted-foreground">Content with a footer below.</p>
    ),
    footer: (
      <div className="flex justify-end gap-2">
        <button className="text-sm px-3 py-1 rounded bg-secondary">
          Cancel
        </button>
        <button className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground">
          Save
        </button>
      </div>
    ),
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    header: <h3 className="font-semibold">Complete Card</h3>,
    children: (
      <div className="space-y-2">
        <p className="text-muted-foreground">
          This card has both header and footer.
        </p>
        <ul className="list-disc list-inside text-sm">
          <li>Feature one</li>
          <li>Feature two</li>
          <li>Feature three</li>
        </ul>
      </div>
    ),
    footer: (
      <div className="text-xs text-muted-foreground">
        Last updated: Dec 29, 2025
      </div>
    ),
  },
};

export const NoPadding: Story = {
  args: {
    padding: "none",
    children: (
      <div className="p-4 bg-secondary">
        <p>This card has no padding, allowing custom spacing control.</p>
      </div>
    ),
  },
};

export const SmallPadding: Story = {
  args: {
    padding: "sm",
    children: <p className="text-sm">Small padding (12px)</p>,
  },
};

export const LargePadding: Story = {
  args: {
    padding: "lg",
    children: <p>Large padding (24px) for spacious layouts</p>,
  },
};

export const Clickable: Story = {
  args: {
    onClick: () => alert("Card clicked!"),
    children: (
      <div>
        <h3 className="font-semibold mb-2">Clickable Card</h3>
        <p className="text-muted-foreground text-sm">
          Click anywhere on this card to trigger an action.
        </p>
      </div>
    ),
  },
};

export const NestedCards: Story = {
  render: () => (
    <Card variant="elevated" padding="lg">
      <h2 className="text-xl font-bold mb-4">Parent Card</h2>
      <div className="grid grid-cols-2 gap-4">
        <Card variant="bordered" padding="sm">
          <h4 className="font-semibold text-sm">Nested 1</h4>
        </Card>
        <Card variant="bordered" padding="sm">
          <h4 className="font-semibold text-sm">Nested 2</h4>
        </Card>
      </div>
    </Card>
  ),
};
