import { z } from 'zod';
import { ValueDriverMetadataSchema } from '../schemas/financial-models.schema';

const ValueDriverRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  parent_id: z.string().uuid().nullable(),
  display_order: z.number().int(),
  metadata: ValueDriverMetadataSchema.nullable()
});

type ValueDriverRow = z.infer<typeof ValueDriverRowSchema>;

export interface ValueTreeNode {
  id: string;
  name: string;
  category: string;
  children: ValueTreeNode[];
  depth: number;
}

export function buildDeterministicTree(
  drivers: ValueDriverRow[]
): ValueTreeNode[] {
  // Strategy 1: Explicit parent pointers exist
  if (drivers.some(d => d.parent_id !== null)) {
    return buildHierarchicalTree(drivers);
  }

  // Strategy 2: Fall back to flat grouping by category
  return buildFlatGroupedTree(drivers);
}

function buildHierarchicalTree(drivers: ValueDriverRow[]): ValueTreeNode[] {
  const nodeMap = new Map<string, ValueTreeNode>();
  const roots: ValueTreeNode[] = [];

  // Sort for determinism: by display_order, then by id
  const sorted = [...drivers].sort((a, b) =>
    a.display_order - b.display_order || a.id.localeCompare(b.id)
  );

  // First pass: create all nodes
  for (const driver of sorted) {
    nodeMap.set(driver.id, {
      id: driver.id,
      name: driver.name,
      category: driver.category,
      children: [],
      depth: 0
    });
  }

  // Second pass: establish relationships
  for (const driver of sorted) {
    const node = nodeMap.get(driver.id)!;
    if (driver.parent_id && nodeMap.has(driver.parent_id)) {
      const parent = nodeMap.get(driver.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildFlatGroupedTree(drivers: ValueDriverRow[]): ValueTreeNode[] {
  const categories = ['revenue', 'cost', 'efficiency', 'risk'] as const;

  return categories
    .map(category => {
      const categoryDrivers = drivers
        .filter(d => d.category === category)
        .sort((a, b) => a.display_order - b.display_order);

      if (categoryDrivers.length === 0) return null;

      return {
        id: `category-${category}`,
        name: category.charAt(0).toUpperCase() + category.slice(1),
        category,
        depth: 0,
        children: categoryDrivers.map(d => ({
          id: d.id,
          name: d.name,
          category: d.category,
          children: [],
          depth: 1
        }))
      };
    })
    .filter((n): n is ValueTreeNode => n !== null);
}