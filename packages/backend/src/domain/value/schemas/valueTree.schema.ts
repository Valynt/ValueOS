import { z } from 'zod';
import { ValueTreeDTO, ValueTreeNodeDTO } from '../dto';

// Invariant: unique node ids, valid parent refs, no cycles
export const ValueTreeNodeSchema = ValueTreeNodeDTO;

export const ValueTreeSchema = ValueTreeDTO.superRefine((tree, ctx) => {
  const ids = new Set<string>();
  for (const node of tree.nodes) {
    if (ids.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate node id: ${node.id}`,
        path: ['nodes'],
      });
    }
    ids.add(node.id);
  }
  // Check parent refs
  for (const node of tree.nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid parentId: ${node.parentId}`,
        path: ['nodes'],
      });
    }
  }
  // Cycle detection (DFS)
  const visited = new Set<string>();
  function visit(id: string, path: Set<string>) {
    if (path.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Cycle detected at node: ${id}`,
        path: ['nodes'],
      });
      return;
    }
    path.add(id);
    const children = tree.nodes.filter(n => n.parentId === id);
    for (const child of children) visit(child.id, path);
    path.delete(id);
  }
  for (const node of tree.nodes) {
    if (!node.parentId) visit(node.id, new Set());
  }
});
