import { DAGDefinitionSpec, ResolvedDAGPlan } from './types';
import { resolveDAGWithRegistry, TaskRegistry } from './taskRegistry';
import { ORCHESTRATION_DAG_CONFIGS } from '../../data/orchestration/dags';

export function loadConfiguredDAG(
  dagId: string,
  registry: TaskRegistry
): ResolvedDAGPlan {
  const definition = ORCHESTRATION_DAG_CONFIGS[dagId];
  if (!definition) {
    throw new Error(`DAG configuration not found for id: ${dagId}`);
  }

  return resolveDAGWithRegistry(definition as DAGDefinitionSpec, registry);
}
