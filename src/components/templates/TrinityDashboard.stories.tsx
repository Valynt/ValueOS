/**
 * Trinity Dashboard Stories
 * Storybook documentation for Trinity Dashboard template
 */

import type { Meta, StoryObj } from "@storybook/react";
import { TrinityDashboard } from "./TrinityDashboard";
import type { TemplateDataSource } from "./index";

const meta: Meta<typeof TrinityDashboard> = {
  title: "Templates/Trinity Dashboard",
  component: TrinityDashboard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "3-pillar ROI dashboard showing Revenue, Cost, and Risk impacts with total value summary.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    interactive: {
      control: "boolean",
      description: "Enable interactive outcome clicking",
    },
    showBreakdown: {
      control: "boolean",
      description: "Show outcome breakdown per pillar",
    },
    compact: {
      control: "boolean",
      description: "Use compact mode for embedding",
    },
    highlightDominant: {
      control: "boolean",
      description: "Highlight the pillar with highest value",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TrinityDashboard>;

// Mock data
const baseDataSource: TemplateDataSource = {
  financials: {
    totalValue: 2500000,
    revenueImpact: 1200000,
    costSavings: 800000,
    riskReduction: 500000,
    roi: 280,
    npv: 2100000,
    paybackPeriod: "7 months",
  },
  outcomes: [
    {
      id: "1",
      name: "Increase customer acquisition",
      category: "revenue",
      impact: 600000,
      description: "20% growth in new customers",
    },
    {
      id: "2",
      name: "Expand to new markets",
      category: "revenue",
      impact: 600000,
      description: "Geographic expansion",
    },
    {
      id: "3",
      name: "Process automation",
      category: "cost",
      impact: 500000,
      description: "40% reduction in manual work",
    },
    {
      id: "4",
      name: "Cloud optimization",
      category: "cost",
      impact: 300000,
      description: "Infrastructure savings",
    },
    {
      id: "5",
      name: "Compliance automation",
      category: "risk",
      impact: 300000,
      description: "Automated SOC 2 controls",
    },
    {
      id: "6",
      name: "Security enhancement",
      category: "risk",
      impact: 200000,
      description: "Reduced breach risk",
    },
  ],
  metrics: [],
};

// Default story
export const Default: Story = {
  args: {
    dataSource: baseDataSource,
    interactive: true,
    showBreakdown: true,
    compact: false,
    highlightDominant: true,
  },
};

// Revenue-dominant scenario
export const RevenueDominant: Story = {
  args: {
    dataSource: {
      ...baseDataSource,
      financials: {
        ...baseDataSource.financials!,
        revenueImpact: 3000000,
        costSavings: 500000,
        riskReduction: 200000,
        totalValue: 3700000,
      },
    },
    highlightDominant: true,
  },
};

// Cost-saving focus
export const CostSavingsFocus: Story = {
  args: {
    dataSource: {
      ...baseDataSource,
      financials: {
        ...baseDataSource.financials!,
        revenueImpact: 300000,
        costSavings: 2500000,
        riskReduction: 200000,
        totalValue: 3000000,
      },
    },
    highlightDominant: true,
  },
};

// Compact mode
export const CompactMode: Story = {
  args: {
    dataSource: baseDataSource,
    compact: true,
    showBreakdown: false,
  },
};

// No breakdown
export const NoBreakdown: Story = {
  args: {
    dataSource: baseDataSource,
    showBreakdown: false,
    highlightDominant: false,
  },
};

// Many outcomes
export const ManyOutcomes: Story = {
  args: {
    dataSource: {
      ...baseDataSource,
      outcomes: [
        ...baseDataSource.outcomes!,
        {
          id: "7",
          name: "Additional revenue stream",
          category: "revenue",
          impact: 100000,
          description: "",
        },
        {
          id: "8",
          name: "Partner channel",
          category: "revenue",
          impact: 150000,
          description: "",
        },
        {
          id: "9",
          name: "AI optimization",
          category: "cost",
          impact: 120000,
          description: "",
        },
        {
          id: "10",
          name: "Data governance",
          category: "risk",
          impact: 80000,
          description: "",
        },
      ],
    },
  },
};

// Edge case: Zero values
export const ZeroValues: Story = {
  args: {
    dataSource: {
      financials: {
        totalValue: 0,
        revenueImpact: 0,
        costSavings: 0,
        riskReduction: 0,
      },
      outcomes: [],
      metrics: [],
    },
  },
};

// Edge case: Missing financials
export const MissingFinancials: Story = {
  args: {
    dataSource: {
      outcomes: baseDataSource.outcomes,
      metrics: [],
    },
  },
};

// Large numbers
export const LargeNumbers: Story = {
  args: {
    dataSource: {
      financials: {
        totalValue: 50000000,
        revenueImpact: 30000000,
        costSavings: 15000000,
        riskReduction: 5000000,
        roi: 450,
        npv: 42000000,
        paybackPeriod: "4 months",
      },
      outcomes: baseDataSource.outcomes,
      metrics: [],
    },
  },
};
