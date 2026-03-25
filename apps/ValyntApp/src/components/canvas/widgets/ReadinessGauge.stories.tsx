/**
 * Storybook Stories: ReadinessGauge
 *
 * Covers: Loading, Low (< 40), Medium (40–70), High (> 70)
 */

import type { Meta, StoryObj } from "@storybook/react";

import { ReadinessGauge } from "./ReadinessGauge";
import type { ReadinessGaugeData } from "./ReadinessGauge";

const meta: Meta<typeof ReadinessGauge> = {
  title: "Canvas/ReadinessGauge",
  component: ReadinessGauge,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ReadinessGauge>;

const baseComponents: ReadinessGaugeData["components"] = {
  validationRate: { name: "Validation Rate", score: 0.75, weight: 0.3 },
  grounding: { name: "Grounding", score: 0.82, weight: 0.25 },
  benchmarkCoverage: { name: "Benchmark Coverage", score: 0.6, weight: 0.25 },
  unsupportedCount: { name: "Unsupported Claims", score: 0.55, weight: 0.2 },
};

const makeData = (overrides: Partial<ReadinessGaugeData>) => ({
  id: "readiness-gauge",
  data: {
    readiness: {
      compositeScore: 75,
      status: "draft" as const,
      components: baseComponents,
      blockers: [],
      ...overrides,
    } satisfies ReadinessGaugeData,
  },
  onAction: undefined,
});

export const Loading: Story = {
  render: () => (
    <div className="rounded-xl border bg-card p-6 w-full max-w-lg animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-32 h-32 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-3">
          <div className="h-3 bg-muted rounded w-1/3 mb-1" />
          <div className="h-2 bg-muted rounded w-full" />
        </div>
      ))}
    </div>
  ),
};

export const Low: Story = {
  args: makeData({
    compositeScore: 28,
    status: "blocked",
    components: {
      validationRate: { name: "Validation Rate", score: 0.25, weight: 0.3 },
      grounding: { name: "Grounding", score: 0.3, weight: 0.25 },
      benchmarkCoverage: { name: "Benchmark Coverage", score: 0.2, weight: 0.25 },
      unsupportedCount: { name: "Unsupported Claims", score: 0.35, weight: 0.2 },
    },
    blockers: [
      "3 hypotheses lack tier-1 evidence",
      "Benchmark coverage below 40%",
      "2 assumptions have no source citation",
    ],
  }),
};

export const Medium: Story = {
  args: makeData({
    compositeScore: 58,
    status: "draft",
    components: {
      validationRate: { name: "Validation Rate", score: 0.62, weight: 0.3 },
      grounding: { name: "Grounding", score: 0.55, weight: 0.25 },
      benchmarkCoverage: { name: "Benchmark Coverage", score: 0.58, weight: 0.25 },
      unsupportedCount: { name: "Unsupported Claims", score: 0.6, weight: 0.2 },
    },
    blockers: ["1 hypothesis lacks supporting evidence"],
  }),
};

export const High: Story = {
  args: makeData({
    compositeScore: 91,
    status: "presentation-ready",
    components: {
      validationRate: { name: "Validation Rate", score: 0.95, weight: 0.3 },
      grounding: { name: "Grounding", score: 0.88, weight: 0.25 },
      benchmarkCoverage: { name: "Benchmark Coverage", score: 0.92, weight: 0.25 },
      unsupportedCount: { name: "Unsupported Claims", score: 0.9, weight: 0.2 },
    },
    blockers: [],
  }),
};
