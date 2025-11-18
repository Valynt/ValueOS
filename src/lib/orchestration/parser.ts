import { DAGDefinitionSpec, DAGNodeSpec, DAGValidationError } from './types';
import { detectCycles, topologicalSort } from './utils';

export function validateAgainstSchema(input: any): DAGValidationError[] {
  const errors: DAGValidationError[] = [];

  if (typeof input !== 'object' || input === null) {
    return [{ path: 'root', message: 'DAG definition must be an object' }];
  }

  const required = ['id', 'name', 'version', 'nodes', 'entrypoints'];
  required.forEach(field => {
    if (input[field] === undefined) {
      errors.push({ path: field, message: 'Missing required field' });
    }
  });

  if (input.nodes && !Array.isArray(input.nodes)) {
    errors.push({ path: 'nodes', message: 'Nodes must be an array' });
  }

  if (input.entrypoints && !Array.isArray(input.entrypoints)) {
    errors.push({ path: 'entrypoints', message: 'Entrypoints must be an array of node ids' });
  }

  if (Array.isArray(input.nodes)) {
    input.nodes.forEach((node: DAGNodeSpec, index: number) => {
      ['id', 'name', 'task'].forEach(field => {
        if (!node || typeof node[field as keyof DAGNodeSpec] !== 'string') {
          errors.push({ path: `nodes[${index}].${field}`, message: `${field} is required` });
        }
      });
      if (node.depends_on && !Array.isArray(node.depends_on)) {
        errors.push({ path: `nodes[${index}].depends_on`, message: 'depends_on must be an array when provided' });
      }
    });
  }

  return errors;
}

export function parseDAGDefinition(input: any): { definition: DAGDefinitionSpec; order: string[] } {
  const schemaErrors = validateAgainstSchema(input);
  if (schemaErrors.length > 0) {
    const message = schemaErrors.map(err => `${err.path}: ${err.message}`).join('; ');
    throw new Error(`Invalid DAG definition: ${message}`);
  }

  const definition: DAGDefinitionSpec = {
    id: input.id,
    name: input.name,
    version: input.version,
    description: input.description,
    metadata: input.metadata,
    nodes: input.nodes.map((node: DAGNodeSpec) => ({
      ...node,
      depends_on: node.depends_on || [],
      metadata: node.metadata || {},
    })),
    entrypoints: [...input.entrypoints],
  };

  const nodeIds = new Set(definition.nodes.map(node => node.id));
  if (nodeIds.size !== definition.nodes.length) {
    throw new Error('Invalid DAG definition: duplicate node ids detected');
  }

  definition.entrypoints.forEach(entry => {
    if (!nodeIds.has(entry)) {
      throw new Error(`Invalid DAG definition: entrypoint ${entry} does not reference a node`);
    }
  });

  definition.nodes.forEach(node => {
    node.depends_on?.forEach(dep => {
      if (!nodeIds.has(dep)) {
        throw new Error(`Invalid DAG definition: dependency ${dep} on node ${node.id} not found`);
      }
    });
  });

  const cycles = detectCycles(definition.nodes);
  if (cycles.length > 0) {
    const cycleDescription = cycles.map(cycle => cycle.join(' -> ')).join(', ');
    throw new Error(`Invalid DAG definition: cycle detected (${cycleDescription})`);
  }

  const order = topologicalSort(definition.nodes);

  return { definition, order };
}
