/**
 * MetricCard Storybook Stories
 */

import type { Meta, StoryObj } from "@storybook/react";
import { MetricCard } from "./MetricCard";
import { DollarSign, TrendingUp, Users } from "lucide-react";

const meta: Meta<typeof MetricCard> = {
  title: "Atoms/MetricCard",
  component: MetricCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "MetricCard displays a value with Truth Engine verification status, confidence score, and source citations.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Verified: Story = {
  args: {
    label: "Total Revenue",
    value: "$1.2M",
    verified: true,
    confidence: 92,
    citations: ["CRM-12345", "DB-67890"],
    variant: "success",
    icon: <DollarSign className="w-4 h-4" />,
  },
};

export const Unverified: Story = {
  args: {
    label: "Projected Savings",
    value: "$450K",
    verified: false,
    confidence: 68,
    citations: ["API-54321"],
    variant: "warning",
  },
};

export const WithTrend: Story = {
  args: {
    label: "Monthly Growth",
    value: "23%",
    verified: true,
    confidence: 85,
    trend: "up",
    subtitle: "vs. last month",
    variant: "primary",
    icon: <TrendingUp className="w-4 h-4" />,
  },
};

export const MultipleCitations: Story = {
  args: {
    label: "Customer Acquisition",
    value: "1,234",
    verified: true,
    confidence: 95,
    citations: ["CRM-001", "CRM-002", "DB-003", "API-004", "DOC-005"],
    icon: <Users className="w-4 h-4" />,
  },
};

export const Pending: Story = {
  args: {
    label: "Risk Reduction",
    value: "$200K",
    verified: false,
    citations: [],
    variant: "default",
  },
};

export const Clickable: Story = {
  args: {
    label: "ROI",
    value: "285%",
    verified: true,
    confidence: 89,
    citations: ["DB-99999"],
    onClick: () => alert("Metric clicked!"),
  },
};
