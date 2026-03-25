/**
 * Storybook Stories: ProvenancePanel
 *
 * Covers: Loading, Empty, Open (with evidence items)
 */

import { ProvenancePanel } from "@valueos/components/components/ProvenancePanel";
import type { ProvenanceNode } from "@valueos/components/components/ProvenancePanel";
import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";

const meta: Meta<typeof ProvenancePanel> = {
  title: "Canvas/ProvenancePanel",
  component: ProvenancePanel,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ProvenancePanel>;

const evidenceNodes: ProvenanceNode[] = [
  {
    id: "node-1",
    type: "source",
    label: "CRM Data Export",
    value: "$2.4M ARR",
    sourceBadge: "crm",
    timestamp: "2024-11-15T10:30:00Z",
    confidence: 0.95,
  },
  {
    id: "node-2",
    type: "formula",
    label: "ROI Calculation",
    value: "287%",
    timestamp: "2024-11-15T10:31:00Z",
    confidence: 0.91,
  },
  {
    id: "node-3",
    type: "agent",
    label: "ValueOS AI Agent",
    value: "Validated against Gartner 2024 benchmarks",
    timestamp: "2024-11-15T10:32:00Z",
    confidence: 0.88,
  },
  {
    id: "node-4",
    type: "evidence",
    label: "Gartner Research Note",
    value: "Industry median ROI: 240%",
    sourceBadge: "research",
    timestamp: "2024-11-15T10:33:00Z",
    confidence: 0.92,
  },
  {
    id: "node-5",
    type: "confidence",
    label: "Composite Confidence",
    value: "91%",
    timestamp: "2024-11-15T10:34:00Z",
    confidence: 0.91,
  },
];

// Interactive wrapper so the panel can be opened/closed in Storybook
function PanelWrapper(props: Partial<React.ComponentProps<typeof ProvenancePanel>>) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="relative h-screen bg-background">
      <button
        onClick={() => setIsOpen(true)}
        className="m-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
      >
        Open Panel
      </button>
      <ProvenancePanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        claimValue="$4.1M NPV"
        nodes={evidenceNodes}
        {...props}
      />
    </div>
  );
}

export const Loading: Story = {
  render: () => <PanelWrapper loading={true} nodes={[]} />,
};

export const Empty: Story = {
  render: () => <PanelWrapper nodes={[]} claimValue="$0" />,
};

export const Open: Story = {
  render: () => <PanelWrapper />,
};

export const WithError: Story = {
  render: () => (
    <PanelWrapper
      nodes={[]}
      error="Failed to load provenance data. Please try again."
    />
  ),
};
