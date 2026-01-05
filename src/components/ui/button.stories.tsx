/**
 * VALYNT Button Component Stories
 * 
 * Demonstrates shadcn/ui Button component with VALYNT design system integration.
 * 
 * Design Semantics:
 * - default: Value Intelligence actions (Teal)
 * - secondary: Structure/metadata actions (Grey)
 * - outline: Tertiary actions
 * - ghost: Minimal actions
 * - destructive: Dangerous actions (Error Red)
 * - link: Inline navigation
 */

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Loader2, Download, Trash2, Settings, Plus } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "VALYNT/shadcn/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Button component with VALYNT design system integration. Uses Value Teal for primary actions (value intelligence) and Graph Grey for secondary actions (structure/metadata).",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "destructive", "link"],
      description: "Button variant mapped to VALYNT semantics",
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
      description: "Button size",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Primary Actions (Value Intelligence - Teal)
export const Default: Story = {
  args: {
    children: "Value Action",
  },
};

export const DefaultWithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="mr-2 h-4 w-4" />
        Create Metric
      </>
    ),
  },
};

// Secondary Actions (Structure/Metadata - Grey)
export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Structure Action",
  },
};

export const SecondaryWithIcon: Story = {
  args: {
    variant: "secondary",
    children: (
      <>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </>
    ),
  },
};

// Outline Variant
export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline Button",
  },
};

export const OutlineWithIcon: Story = {
  args: {
    variant: "outline",
    children: (
      <>
        <Download className="mr-2 h-4 w-4" />
        Export
      </>
    ),
  },
};

// Ghost Variant
export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost Button",
  },
};

// Destructive Actions (Error Red)
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
};

export const DestructiveWithIcon: Story = {
  args: {
    variant: "destructive",
    children: (
      <>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Metric
      </>
    ),
  },
};

// Link Variant
export const Link: Story = {
  args: {
    variant: "link",
    children: "Learn More",
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Button",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Button",
  },
};

export const Icon: Story = {
  args: {
    size: "icon",
    children: <Plus className="h-4 w-4" />,
  },
};

// States
export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </>
    ),
  },
};

// VALYNT Semantic Examples
export const VALYNTSemantics: Story = {
  render: () => (
    <div className="space-y-6 p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Value Intelligence Actions (Teal)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Use for value-related actions: metrics, outcomes, economic intelligence
        </p>
        <div className="flex gap-2">
          <Button>Calculate ROI</Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Metric
          </Button>
          <Button size="sm">Analyze Value</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Structure Actions (Grey)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Use for structural actions: navigation, metadata, graph operations
        </p>
        <div className="flex gap-2">
          <Button variant="secondary">View Graph</Button>
          <Button variant="secondary">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
          <Button variant="ghost">Metadata</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Tertiary Actions (Outline)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Use for less prominent actions
        </p>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Destructive Actions (Error Red)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Use for dangerous actions: delete, remove, reset
        </p>
        <div className="flex gap-2">
          <Button variant="destructive">Delete</Button>
          <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Metric
          </Button>
        </div>
      </div>
    </div>
  ),
};

// All Variants Comparison
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 p-6 bg-vc-surface-1 rounded-lg">
      <div className="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled>Disabled</Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </div>
    </div>
  ),
};

// All Sizes Comparison
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-6 bg-vc-surface-1 rounded-lg">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};
