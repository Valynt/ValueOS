import type { Meta, StoryObj } from "@storybook/react";

import { ProvenancePanel } from "./ProvenancePanel";

const meta: Meta<typeof ProvenancePanel> = { title: "Canvas/ProvenancePanel", component: ProvenancePanel };
export default meta;
type Story = StoryObj<typeof ProvenancePanel>;

const claim = { id: "c1", statement: "Pipeline conversion improved by 12%.", confidence: 0.82, evidenceCount: 3, sources: [{ id: "s1", type: "benchmark" as const, title: "SaaS Benchmark 2025", snippet: "Median 10-15% uplift", confidence: 0.81 }] };

export const Default: Story = { args: { id: "p1", data: { claim } } };
export const HighConfidence: Story = { args: { id: "p1", data: { claim: { ...claim, confidence: 0.95 } } } };
export const LowConfidence: Story = { args: { id: "p1", data: { claim: { ...claim, confidence: 0.31 } } } };
export const Empty: Story = { args: { id: "p1", data: { claim: { ...claim, sources: [] } } } };
