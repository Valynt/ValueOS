import { DAGNodeSpec } from './types';

export function normalizeDependencies(nodes: DAGNodeSpec[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  nodes.forEach(node => {
    adjacency.set(node.id, [...(node.depends_on || [])]);
  });
  return adjacency;
}

export function detectCycles(nodes: DAGNodeSpec[]): string[][] {
  const adjacency = normalizeDependencies(nodes);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  const dfs = (nodeId: string, path: string[]) => {
    if (stack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);

    const deps = adjacency.get(nodeId) || [];
    deps.forEach(dep => dfs(dep, [...path, dep]));

    stack.delete(nodeId);
  };

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id, [node.id]);
    }
  });

  return cycles;
}

export function topologicalSort(nodes: DAGNodeSpec[]): string[] {
  const adjacency = normalizeDependencies(nodes);
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    inDegree.set(node.id, (node.depends_on || []).length);
    (node.depends_on || []).forEach(dep => {
      if (!inDegree.has(dep)) {
        inDegree.set(dep, 0);
      }
    });
  });

  const queue: string[] = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId);

  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    const dependents = Array.from(adjacency.entries()).filter(([, deps]) => deps.includes(current));
    dependents.forEach(([dependentId, deps]) => {
      const remaining = deps.filter(dep => dep !== current);
      adjacency.set(dependentId, remaining);
      const nextDegree = remaining.length;
      inDegree.set(dependentId, nextDegree);
      if (nextDegree === 0) {
        queue.push(dependentId);
      }
    });
  }

  if (order.length !== inDegree.size) {
    throw new Error('Cycle detected during topological sort');
  }

  return order;
}
