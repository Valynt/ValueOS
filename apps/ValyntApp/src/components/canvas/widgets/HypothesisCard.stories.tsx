import type { Meta, StoryObj } from "@storybook/react";

import { HypothesisCard } from "./HypothesisCard";

const meta: Meta<typeof HypothesisCard> = { title: "Canvas/HypothesisCard", component: HypothesisCard };
export default meta;
type Story = StoryObj<typeof HypothesisCard>;

const baseData = { hypotheses: [{ id: "h1", valueDriver: "Conversion Lift", impactRange: { low: 120000, high: 320000 }, evidenceTier: "tier2" as const, confidenceScore: 0.72, status: "pending" as const }] };

export const Pending: Story = { args: { id: "w1", data: baseData } };
export const Accepted: Story = { args: { id: "w1", data: { hypotheses: [{ ...baseData.hypotheses[0], status: "accepted" as const }] } } };
export const Rejected: Story = { args: { id: "w1", data: { hypotheses: [{ ...baseData.hypotheses[0], status: "rejected" as const }] } } };
export const Modified: Story = { args: { id: "w1", data: { hypotheses: [{ ...baseData.hypotheses[0], status: "modified" as const }] } } };
export const Multiple: Story = { args: { id: "w1", data: { hypotheses: [baseData.hypotheses[0], { ...baseData.hypotheses[0], id: "h2", valueDriver: "Retention" }] } } };
export const Empty: Story = { args: { id: "w1", data: { hypotheses: [] } } };
