/**
 * Trinity Dashboard Storybook Stories
 * Updated with Truth Engine verification integration
 */

import type { Meta, StoryObj } from "@storybook/react";
import { TrinityDashboard } from "./TrinityDashboard";
import type {
  TrinityFinancials,
  TrinityOutcome,
  TrinityVerification,
} from "./TrinityDashboard";

const meta: Meta<typeof TrinityDashboard> = {
  title: "Templates/Trinity Dashboard",
  component: TrinityDashboard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "3-pillar ROI dashboard with Truth Engine verification showing Revenue, Cost, and Risk impacts.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TrinityDashboard>;

const mockFinancials: TrinityFinancials = {
  totalValue: 2500000,
  revenueImpact: 1200000,
  costSavings: 800000,
  riskReduction: 500000,
  roi: 280,
  npv: 2100000,
  paybackPeriod: "7 months",
};

const mockOutcomes: TrinityOutcome[] = [
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
];

const verifiedVerification: TrinityVerification = {
  overall: { passed: true, confidence: 87 },
  revenue: {
    passed: true,
    confidence: 92,
    citations: ["CRM-12345", "SFDC-OP-876"],
  },
  cost: { passed: true, confidence: 85, citations: ["DB-99999"] },
  risk: { passed: true, confidence: 82, citations: ["API-54321"] },
};

const partialVerification: TrinityVerification = {
  overall: { passed: false, confidence: 72 },
  revenue: { passed: true, confidence: 92, citations: ["CRM-12345"] },
  cost: { passed: true, confidence: 85, citations: ["DB-99999"] },
  risk: { passed: false, confidence: 68, citations: [] },
};

export const FullyVerified: Story = {
  args: {
    financials: mockFinancials,
    outcomes: mockOutcomes,
    verification: verifiedVerification,
    showBreakdown: true,
    highlightDominant: true,
  },
};

export const PartiallyVerified: Story = {
  args: {
    financials: mockFinancials,
    outcomes: mockOutcomes,
    verification: partialVerification,
    showBreakdown: true,
    highlightDominant: true,
  },
};

export const NoBreakdown: Story = {
  args: {
    financials: mockFinancials,
    outcomes: mockOutcomes,
    verification: verifiedVerification,
    showBreakdown: false,
    highlightDominant: true,
  },
};

export const NoDominantHighlight: Story = {
  args: {
    financials: mockFinancials,
    outcomes: mockOutcomes,
    verification: verifiedVerification,
    showBreakdown: true,
    highlightDominant: false,
  },
};

export const RevenueDominant: Story = {
  args: {
    financials: {
      totalValue: 3700000,
      revenueImpact: 3000000,
      costSavings: 500000,
      riskReduction: 200000,
      roi: 450,
      npv: 3200000,
      paybackPeriod: "4 months",
    },
    outcomes: mockOutcomes,
    verification: verifiedVerification,
    showBreakdown: true,
    highlightDominant: true,
  },
};

export const CostSavingsFocus: Story = {
  args: {
    financials: {
      totalValue: 3000000,
      revenueImpact: 300000,
      costSavings: 2500000,
      riskReduction: 200000,
      roi: 380,
      npv: 2600000,
      paybackPeriod: "5 months",
    },
    outcomes: mockOutcomes,
    verification: verifiedVerification,
    showBreakdown: true,
    highlightDominant: true,
  },
};

export const MinimalData: Story = {
  args: {
    financials: {
      totalValue: 1000000,
      revenueImpact: 600000,
      costSavings: 300000,
      riskReduction: 100000,
    },
    outcomes: [],
    verification: verifiedVerification,
    showBreakdown: true,
    highlightDominant: true,
  },
};

export const LowConfidence: Story = {
  args: {
    financials: mockFinancials,
    outcomes: mockOutcomes,
    verification: {
      overall: { passed: false, confidence: 55 },
      revenue: { passed: false, confidence: 62, citations: ["CRM-12345"] },
      cost: { passed: false, confidence: 58, citations: [] },
      risk: { passed: false, confidence: 45, citations: [] },
    },
    showBreakdown: true,
    highlightDominant: true,
  },
};
