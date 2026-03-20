import { describe, bench } from 'vitest';
import { ValueTreeService } from '../ValueTreeWriteService';

describe('ValueTreeService - calculatePathWeight', () => {
  const service = new ValueTreeService({} as any);

  // Generate a large tree structure for testing
  const tree = {
    id: 'tree_1',
    name: 'Test Tree',
    version: 1,
    nodes: [],
    links: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as any;

  // Fill nodes and links
  let idCounter = 1;
  const generateTree = (depth: number, breadth: number, parentId?: string) => {
    const nodeId = "node_" + idCounter++;
    tree.nodes.push({
      node_id: nodeId,
      label: "Node " + nodeId,
      type: 'outcome',
      value: 100
    });

    if (parentId) {
      tree.links.push({
        parent_node_id: parentId,
        child_node_id: nodeId,
        weight: 0.5
      });
    }

    if (depth > 0) {
      for (let i = 0; i < breadth; i++) {
        generateTree(depth - 1, breadth, nodeId);
      }
    }
  };

  generateTree(7, 4); // generate larger tree (21844 links)

  const paths = [];

  // Let's generate multiple paths since `calculatePathWeight` is called for every downstream node path
  // In `calculateValueImpact`, we iterate multiple paths.
  let currentId = 'node_1';
  let path = [currentId];
  for (let i = 0; i < 6; i++) {
    const link = tree.links.find((l: any) => l.parent_node_id === currentId);
    if (link) {
      currentId = link.child_node_id;
      path.push(currentId);
    } else {
      break;
    }
  }

  paths.push(path);

  // Generate some more paths
  for(let i=0; i<10; i++) {
     paths.push([...path]);
  }

  const calculatePathWeight = (service as any).calculatePathWeight.bind(service);

  bench('calculatePathWeight - multiple paths', () => {
    for (const p of paths) {
      calculatePathWeight(p, tree);
    }
  });
});
