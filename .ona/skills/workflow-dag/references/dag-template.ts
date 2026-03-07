/**
 * MY_WORKFLOW
 *
 * [One-line description of what this workflow orchestrates.]
 *
 * Replace all <MY_WORKFLOW> / <my-workflow> / <stage_*> placeholders before use.
 *
 * After defining the DAG, add it to WORKFLOW_REGISTRY in WorkflowDAGDefinitions.ts:
 *   export const WORKFLOW_REGISTRY = { ...existing, MY_WORKFLOW } as const;
 *
 * WorkflowDAGExecutor.registerAllWorkflows() picks it up automatically from
 * ALL_WORKFLOW_DEFINITIONS = Object.values(WORKFLOW_REGISTRY).
 * Do not modify WorkflowDAGIntegration.ts.
 */

import type { WorkflowDAG } from "../../types/workflow.js";
import { createStage, RETRY_CONFIGS } from "./WorkflowDAGDefinitions.js";

export const MY_WORKFLOW: WorkflowDAG = {
  id: "my-workflow-v1",           // unique kebab-case id + version suffix
  name: "My Workflow",
  description: "What this workflow does and why it exists.",
  version: 1,

  stages: [
    // Stage A — entry point
    createStage(
      "stage_a",                  // unique snake_case id
      "Stage A Name",             // human-readable label
      "opportunity",              // agent_type: "opportunity"|"target"|"realization"|"expansion"|"integrity"
      90,                         // timeout_seconds
      RETRY_CONFIGS.STANDARD,     // STANDARD | AGGRESSIVE | CONSERVATIVE | NONE
      "compensateStageA",         // compensation handler name — required, must be idempotent
      ["capability_1"],           // required_capabilities — omit if none
    ),

    // Stage B
    createStage(
      "stage_b",
      "Stage B Name",
      "target",
      120,
      RETRY_CONFIGS.AGGRESSIVE,
      "compensateStageB",
    ),

    // Stage C — terminal
    createStage(
      "stage_c",
      "Stage C Name",
      "realization",
      60,
      RETRY_CONFIGS.CONSERVATIVE,
      "compensateStageC",
    ),
  ],

  // Transitions — must form a DAG (no cycles)
  transitions: [
    { from_stage: "stage_a", to_stage: "stage_b" },
    { from_stage: "stage_b", to_stage: "stage_c" },
    // Conditional transition example:
    // { from_stage: "stage_b", to_stage: "stage_c", condition: "integrity_passed === true" },
  ],

  initial_stage: "stage_a",       // must match a stage id
  final_stages: ["stage_c"],      // must match one or more stage ids

  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Compensation handlers
// Each handler must undo the side effects of its corresponding stage.
// All handlers must be idempotent (safe to call multiple times).
// ---------------------------------------------------------------------------

export async function compensateStageA(context: Record<string, unknown>): Promise<void> {
  // Undo stage_a side effects (e.g. delete created records, revert state)
  void context;
}

export async function compensateStageB(context: Record<string, unknown>): Promise<void> {
  void context;
}

export async function compensateStageC(context: Record<string, unknown>): Promise<void> {
  void context;
}
