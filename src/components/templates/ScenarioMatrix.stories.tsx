/**
 * Scenario Matrix Stories
 * Storybook documentation for Scenario Matrix template
 */

import type { Meta, StoryObj } from "@storybook/react";
import { ScenarioMatrix } from "./ScenarioMatrix";
import type { TemplateDataSource } from "./index";

const meta: Meta<typeof ScenarioMatrix> = {
  title: "Templates/Scenario Matrix",
  component: ScenarioMatrix,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "What-if analysis comparing Conservative, Expected, and Optimistic scenarios with probability weighting.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    showWeightedValue: {
      control: "boolean",
      description: "Show probability-weighted expected value",
    },
    selectable: {
      control: "boolean",
      description: "Allow scenario selection",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScenarioMatrix>;

const baseDataSource: TemplateDataSource = {
  financials: {
    totalValue: 2000000,
    revenueImpact: 1200000,
    costSavings: 600000,
    riskReduction: 200000,
    roi: 300,
    paybackPeriod: "6 months",
    npv: 1800000,
  },
  outcomes: [],
  metrics: [
    {
      id: "1",
      name: "Customer Acquisition",
      value: 150,
      target: 200,
      unit: "customers/month",
      baseline: 100,
    },
    {
      id: "2",
      name: "Conversion Rate",
      value: 12,
      target: 18,
      unit: "%",
      baseline: 10,
    },
    {
      id: "3",
      name: "Operational Efficiency",
      value: 75,
      target: 90,
      unit: "%",
      baseline: 65,
    },
  ],
};

export const Default: Story = {
  args: {
    dataSource: baseDataSource,
    showWeightedValue: true,
    selectable: true,
  },
};

export const WithoutWeightedValue: Story = {
  args: {
    dataSource: baseDataSource,
    showWeightedValue: false,
  },
};

export const CustomScenarios: Story = {
  args: {
    dataSource: baseDataSource,
    scenarios: [
      {
        type: "conservative",
        name: "Worst Case",
        modifier: 0.5,
        probability: 0.15,
      },
      {
        type: "expected",
        name: "Most Likely",
        modifier: 1.0,
        probability: 0.7,
      },
      {
        type: "optimistic",
        name: "Best Case",
        modifier: 2.0,
        probability: 0.15,
      },
    ],
    showWeightedValue: true,
  },
};

export const HighVariability: Story = {
  args: {
    dataSource: baseDataSource,
    scenarios: [
      {
        type: "conservative",
        name: "Pessimistic",
        modifier: 0.3,
        probability: 0.2,
      },
      { type: "expected", name: "Baseline", modifier: 1.0, probability: 0.5 },
      {
        type: "optimistic",
        name: "Aggressive",
        modifier: 3.0,
        probability: 0.3,
      },
    ],
  },
};

export const NonSelectable: Story = {
  args: {
    dataSource: baseDataSource,
    selectable: false,
  },
};
