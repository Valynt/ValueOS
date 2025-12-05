export interface DAGNodeSpec {
  id: string;
  name: string;
  task: string;
  depends_on?: string[];
  metadata?: Record<string, any>;
}

export interface DAGDefinitionSpec {
  id: string;
  name: string;
  version: number;
  description?: string;
  nodes: DAGNodeSpec[];
  entrypoints: string[];
  metadata?: Record<string, any>;
}

export interface DAGValidationError {
  path: string;
  message: string;
}

export const DAG_JSON_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'version', 'nodes', 'entrypoints'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'number' },
    description: { type: 'string' },
    metadata: { type: 'object' },
    entrypoints: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' }
    },
    nodes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'task'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          task: { type: 'string' },
          depends_on: {
            type: 'array',
            items: { type: 'string' }
          },
          metadata: { type: 'object' }
        }
      }
    }
  }
} as const;

export type TaskHandler = (
  context: Record<string, any>
) => Promise<Record<string, any> | void> | Record<string, any> | void;

export interface ResolvedTaskNode {
  id: string;
  name: string;
  task: string;
  depends_on: string[];
  handler: TaskHandler;
}

export interface ResolvedDAGPlan {
  definition: DAGDefinitionSpec;
  executionOrder: string[];
  tasks: Map<string, ResolvedTaskNode>;
}
