import { DAGDefinitionSpec, ResolvedDAGPlan, ResolvedTaskNode, TaskHandler } from './types';
import { parseDAGDefinition } from './parser';

export class TaskRegistry {
  private tasks = new Map<string, TaskHandler>();

  register(task: string, handler: TaskHandler): void {
    this.tasks.set(task, handler);
  }

  resolve(task: string): TaskHandler {
    const handler = this.tasks.get(task);
    if (!handler) {
      throw new Error(`Task handler not found for task: ${task}`);
    }
    return handler;
  }

  has(task: string): boolean {
    return this.tasks.has(task);
  }
}

export function resolveDAGWithRegistry(
  dagDefinition: DAGDefinitionSpec,
  registry: TaskRegistry
): ResolvedDAGPlan {
  const { definition, order } = parseDAGDefinition(dagDefinition);

  const tasks = new Map<string, ResolvedTaskNode>();

  definition.nodes.forEach(node => {
    const handler = registry.resolve(node.task);
    tasks.set(node.id, {
      id: node.id,
      name: node.name,
      task: node.task,
      depends_on: node.depends_on || [],
      handler,
    });
  });

  return {
    definition,
    executionOrder: order,
    tasks,
  };
}
