import { DAGDefinitionSpec } from '../../lib/orchestration/types';

export const ORCHESTRATION_DAG_CONFIGS: Record<string, DAGDefinitionSpec> = {
  'value-canvas-lifecycle': {
    id: 'value-canvas-lifecycle',
    name: 'Value Canvas Lifecycle',
    description: 'High-level lifecycle DAG coordinating opportunity through integrity tasks',
    version: 1,
    entrypoints: ['opportunity'],
    nodes: [
      {
        id: 'opportunity',
        name: 'Opportunity Discovery',
        task: 'opportunity.discover',
        depends_on: [],
      },
      {
        id: 'target',
        name: 'Target Commit',
        task: 'target.commit',
        depends_on: ['opportunity'],
      },
      {
        id: 'realization',
        name: 'Realization Tracking',
        task: 'realization.track',
        depends_on: ['target'],
      },
      {
        id: 'expansion',
        name: 'Expansion Modeling',
        task: 'expansion.model',
        depends_on: ['realization'],
      },
      {
        id: 'integrity',
        name: 'Integrity & Controls',
        task: 'integrity.validate',
        depends_on: ['expansion'],
      },
    ],
  },
  'parallel-quality-check': {
    id: 'parallel-quality-check',
    name: 'Parallel Review with Quality',
    description: 'Demonstrates branching, merges, and a quality gate',
    version: 1,
    entrypoints: ['ingest'],
    nodes: [
      {
        id: 'ingest',
        name: 'Ingest Data',
        task: 'ingest',
        depends_on: [],
      },
      {
        id: 'transform-a',
        name: 'Transform Path A',
        task: 'transform.a',
        depends_on: ['ingest'],
      },
      {
        id: 'transform-b',
        name: 'Transform Path B',
        task: 'transform.b',
        depends_on: ['ingest'],
      },
      {
        id: 'quality',
        name: 'Quality Review',
        task: 'quality',
        depends_on: ['transform-a', 'transform-b'],
      },
      {
        id: 'publish',
        name: 'Publish Result',
        task: 'publish',
        depends_on: ['quality'],
      },
    ],
  },
};
