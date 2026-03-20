import type { Meta, StoryObj } from "@storybook/react";

import { PipelineStepper } from "../components/orchestration/PipelineStepper";
import type { PipelineStepState } from "../hooks/useValueCaseStream";

const STEP_NAMES = ["Hypothesis", "Model", "Evidence", "Narrative", "Objection", "Revision", "Approval"] as const;

function makeSteps(statuses: Array<PipelineStepState["status"]>): PipelineStepState[] {
  return STEP_NAMES.map((name, i) => ({
    id: `step-${i}`,
    name,
    status: statuses[i] ?? "pending",
    agentName: `${name} Agent`,
    startedAt: statuses[i] !== "pending" ? Date.now() - 1000 * (7 - i) : undefined,
    completedAt: statuses[i] === "completed" ? Date.now() - 500 * (7 - i) : undefined,
    confidence: statuses[i] === "completed" ? 0.85 + i * 0.01 : undefined,
  }));
}

const meta: Meta<typeof PipelineStepper> = {
  title: "Orchestration/PipelineStepper",
  component: PipelineStepper,
  parameters: { layout: "padded" },
};
export default meta;

export const InProgress: StoryObj<typeof PipelineStepper> = {
  args: {
    steps: makeSteps(["completed", "completed", "running", "pending", "pending", "pending", "pending"]),
    revisionCycle: 0,
  },
};

export const Complete: StoryObj<typeof PipelineStepper> = {
  args: {
    steps: makeSteps(["completed", "completed", "completed", "completed", "completed", "completed", "completed"]),
    revisionCycle: 0,
  },
};

export const WithRevision: StoryObj<typeof PipelineStepper> = {
  args: {
    steps: makeSteps(["completed", "completed", "completed", "running", "pending", "pending", "pending"]),
    revisionCycle: 2,
    maxRevisionCycles: 3,
  },
};
