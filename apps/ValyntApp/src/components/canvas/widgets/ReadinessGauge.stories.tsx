import type { Meta, StoryObj } from "@storybook/react";

import { ReadinessGauge } from "./ReadinessGauge";

const meta: Meta<typeof ReadinessGauge> = { title: "Canvas/ReadinessGauge", component: ReadinessGauge };
export default meta;
type Story = StoryObj<typeof ReadinessGauge>;

const ready = { readiness: { compositeScore: 0.86, status: "presentation-ready" as const, components: { validationRate: { name: "Validation", score: 0.9, weight: 0.25 }, grounding: { name: "Grounding", score: 0.84, weight: 0.25 }, benchmarkCoverage: { name: "Benchmark", score: 0.87, weight: 0.25 }, unsupportedCount: { name: "Unsupported", score: 0.8, weight: 0.25 } }, blockers: [] } };

export const Ready: Story = { args: { id: "r1", data: ready } };
export const Draft: Story = { args: { id: "r1", data: { readiness: { ...ready.readiness, compositeScore: 0.62, status: "draft" } } } };
export const Blocked: Story = { args: { id: "r1", data: { readiness: { ...ready.readiness, compositeScore: 0.41, status: "blocked", blockers: ["Evidence gaps", "Unsupported claims"] } } } };
export const Empty: Story = { args: { id: "r1", data: { readiness: { ...ready.readiness, components: undefined } } } };
