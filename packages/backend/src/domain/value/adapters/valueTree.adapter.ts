import { ValueTree, ValueTreeNode } from '../dto';
import { ValueTreeSchema } from '../schemas/valueTree.schema';

// Accepts DB rows, returns validated ValueTree domain object
export function fromValueDrivers(valueCaseId: string, rows: any[]): ValueTree {
  // Map DB rows to ValueTreeNode
  const nodes: ValueTreeNode[] = rows.map(row => ({
    id: row.id,
    parentId: row.parent_id ?? null,
    label: row.label,
    driverType: row.driver_type,
    value: row.value ?? null,
  }));
  const tree: ValueTree = { valueCaseId, nodes };
  ValueTreeSchema.parse(tree); // throws if invalid
  return tree;
}
