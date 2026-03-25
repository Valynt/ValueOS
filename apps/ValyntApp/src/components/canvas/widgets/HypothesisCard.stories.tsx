/**
 * Storybook Stories: HypothesisCard
 *
 * Covers: Loading, Empty, WithPendingHypotheses, WithAcceptedHypotheses, WithRejectedHypotheses
 */

import type { Meta, StoryObj } from "@storybook/react";

import { HypothesisCard } from "./HypothesisCard";
import type { HypothesisData } from "./HypothesisCard";

const meta: Meta<typeof HypothesisCard> = {
  title: "Canvas/HypothesisCard",
  component: HypothesisCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof HypothesisCard>;

const pendingHypotheses: HypothesisData[] = [
  {
    id: "hyp-001",
    valueDriver: "Sales Cycle Reduction",
    impactRange: { low: 420000, high: 780000 },
    evidenceTier: "tier1",
    confidenceScore: 0.87,
    status: "pending",
    benchmarkReference: { source: "Gartner 2024", p25: 380000, p50: 580000, p75: 720000 },
  },
  {
    id: "hyp-002",
    valueDriver: "Customer Retention Improvement",
    impactRange: { low: 210000, high: 490000 },
    evidenceTier: "tier2",
    confidenceScore: 0.72,
    status: "pending",
  },
];

const acceptedHypotheses: HypothesisData[] = [
  {
    id: "hyp-003",
    valueDriver: "Operational Efficiency Gains",
    impactRange: { low: 150000, high: 320000 },
    evidenceTier: "tier1",
    confidenceScore: 0.91,
    status: "accepted",
    benchmarkReference: { source: "McKinsey 2023", p25: 140000, p50: 240000, p75: 310000 },
  },
  {
    id: "hyp-004",
    valueDriver: "Support Cost Reduction",
    impactRange: { low: 80000, high: 180000 },
    evidenceTier: "tier2",
    confidenceScore: 0.68,
    status: "accepted",
  },
];

const rejectedHypotheses: HypothesisData[] = [
  {
    id: "hyp-005",
    valueDriver: "Infrastructure Cost Savings",
    impactRange: { low: 50000, high: 120000 },
    evidenceTier: "tier3",
    confidenceScore: 0.41,
    status: "rejected",
  },
];

export const Loading: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: [] },
    onAction: undefined,
  },
  render: () => (
    <div className="space-y-4 w-full max-w-2xl">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-3" />
          <div className="h-3 bg-muted rounded w-2/3 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  ),
};

export const Empty: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: [] },
    onAction: (action, payload) => console.log("action:", action, payload),
  },
};

export const WithPendingHypotheses: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: pendingHypotheses },
    onAction: (action, payload) => console.log("action:", action, payload),
  },
};

export const WithAcceptedHypotheses: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: acceptedHypotheses },
    onAction: (action, payload) => console.log("action:", action, payload),
  },
};

export const WithRejectedHypotheses: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: rejectedHypotheses },
    onAction: (action, payload) => console.log("action:", action, payload),
  },
};

export const Mixed: Story = {
  args: {
    id: "hypothesis-card",
    data: { hypotheses: [...pendingHypotheses, ...acceptedHypotheses, ...rejectedHypotheses] },
    onAction: (action, payload) => console.log("action:", action, payload),
  },
};
