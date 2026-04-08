import type { WorkflowDAG } from "../../types/workflow.js";

import { validateWorkflowDAG } from "./dag-validator.js";

export function validateWorkflowDAGSchema(rawDag: unknown): WorkflowDAG {
  return validateWorkflowDAG(rawDag);
}
