import type { WorkflowDAG } from '../../types/workflow.js';

export function validateWorkflowDAG(rawDag: unknown): WorkflowDAG {
  if (!rawDag || typeof rawDag !== 'object') throw new Error('Invalid workflow DAG: must be an object');
  const dag = rawDag as WorkflowDAG;
  if (!Array.isArray(dag.stages) || dag.stages.length === 0) throw new Error('Invalid workflow DAG: stages must be a non-empty array');
  if (!dag.initial_stage) throw new Error('Invalid workflow DAG: initial_stage is required');
  if (!Array.isArray(dag.final_stages) || dag.final_stages.length === 0) throw new Error('Invalid workflow DAG: final_stages must be a non-empty array');

  const stageIds = new Set(dag.stages.map((s) => s.id));
  if (!stageIds.has(dag.initial_stage)) throw new Error('Workflow DAG initial_stage must reference an existing stage');

  const missingFinals = dag.final_stages.filter((s) => !stageIds.has(s));
  if (missingFinals.length > 0) {
    throw new Error(`Workflow DAG final_stages reference missing stages: ${missingFinals.join(', ')}`);
  }

  const adjacency = new Map<string, string[]>();
  for (const stageId of stageIds) {
    adjacency.set(stageId, []);
  }

  for (const transition of dag.transitions ?? []) {
    const fromStage = transition.from_stage;
    const toStage = transition.to_stage;
    if (!fromStage || !toStage || !stageIds.has(fromStage) || !stageIds.has(toStage)) {
      continue;
    }
    const nextStages = adjacency.get(fromStage);
    if (nextStages) {
      nextStages.push(toStage);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const traversalPath: string[] = [];

  const detectCycle = (stageId: string): string[] | null => {
    visited.add(stageId);
    recursionStack.add(stageId);
    traversalPath.push(stageId);

    for (const nextStage of adjacency.get(stageId) ?? []) {
      if (!visited.has(nextStage)) {
        const cycle = detectCycle(nextStage);
        if (cycle) {
          return cycle;
        }
      } else if (recursionStack.has(nextStage)) {
        const cycleStart = traversalPath.indexOf(nextStage);
        return [...traversalPath.slice(cycleStart), nextStage];
      }
    }

    traversalPath.pop();
    recursionStack.delete(stageId);
    return null;
  };

  for (const stageId of stageIds) {
    if (visited.has(stageId)) {
      continue;
    }
    const cycle = detectCycle(stageId);
    if (cycle) {
      throw new Error(`Workflow DAG contains cycle: ${cycle.join(' -> ')}`);
    }
  }

  return dag;
}
