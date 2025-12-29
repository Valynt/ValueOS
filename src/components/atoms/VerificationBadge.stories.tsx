/**
 * VerificationBadge Storybook Stories
 */

import type { Meta, StoryObj } from "@storybook/react";
import { VerificationBadge } from "./VerificationBadge";

const meta: Meta<typeof VerificationBadge> = {
  title: "Atoms/VerificationBadge",
  component: VerificationBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "VerificationBadge displays Truth Engine verification status with confidence scores.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["verified", "pending", "failed"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof VerificationBadge>;

export const Verified: Story = {
  args: {
    status: "verified",
    confidence: 92,
    showLabel: true,
    size: "sm",
  },
};

export const VerifiedHighConfidence: Story = {
  args: {
    status: "verified",
    confidence: 98,
    showLabel: true,
    size: "md",
  },
};

export const Pending: Story = {
  args: {
    status: "pending",
    showLabel: true,
    size: "sm",
  },
};

export const Failed: Story = {
  args: {
    status: "failed",
    confidence: 45,
    showLabel: true,
    size: "sm",
  },
};

export const IconOnly: Story = {
  args: {
    status: "verified",
    confidence: 85,
    showLabel: false,
    size: "md",
  },
};

export const LargeSize: Story = {
  args: {
    status: "verified",
    confidence: 90,
    showLabel: true,
    size: "lg",
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex gap-4">
      <VerificationBadge status="verified" confidence={95} showLabel={true} />
      <VerificationBadge status="pending" showLabel={true} />
      <VerificationBadge status="failed" confidence={52} showLabel={true} />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <VerificationBadge
        status="verified"
        confidence={90}
        showLabel={true}
        size="sm"
      />
      <VerificationBadge
        status="verified"
        confidence={90}
        showLabel={true}
        size="md"
      />
      <VerificationBadge
        status="verified"
        confidence={90}
        showLabel={true}
        size="lg"
      />
    </div>
  ),
};
