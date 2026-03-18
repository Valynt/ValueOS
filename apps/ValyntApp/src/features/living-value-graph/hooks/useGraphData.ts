/**
 * useGraphData Hook - Fetch and manage graph data
 */

import { useQuery } from '@tanstack/react-query';

import { Graph } from '../types/graph.types';

const MOCK_TIMESTAMP = '2024-01-15T00:00:00.000Z';

const MOCK_GRAPH: Graph = {
  id: 'graph-001',
  versionId: null,
  scenarioId: 'scenario-001',
  nodes: {
    'node-001': {
      id: 'node-001',
      type: 'driver',
      label: 'DSO Reduction',
      value: 2500000,
      unit: 'USD',
      formula: '(Current DSO - Target DSO) * Daily Revenue',
      confidence: 0.85,
      evidence: [
        {
          id: 'ev-001',
          type: '10-K',
          source: 'TargetCo',
          title: 'Annual Report 2024',
          confidence: 0.9,
          date: '2024-03-15',
          hasAttribution: true,
        },
      ],
      inputs: ['node-002', 'node-003'],
      outputs: [],
      metadata: {
        description: 'Days Sales Outstanding reduction impact',
        owner: 'Alice Chen',
        lastModified: MOCK_TIMESTAMP,
        version: 1,
      },
    },
    'node-002': {
      id: 'node-002',
      type: 'input',
      label: 'Current DSO',
      value: 45,
      unit: 'days',
      confidence: 0.95,
      evidence: [
        {
          id: 'ev-002',
          type: 'erp',
          source: 'SAP',
          title: 'Finance Report Q4 2024',
          confidence: 0.95,
          date: '2024-12-31',
          hasAttribution: true,
        },
      ],
      inputs: [],
      outputs: ['node-001'],
    },
    'node-003': {
      id: 'node-003',
      type: 'input',
      label: 'Target DSO',
      value: 38,
      unit: 'days',
      confidence: 0.8,
      evidence: [
        {
          id: 'ev-003',
          type: 'benchmark',
          source: 'Gartner',
          title: 'Industry Benchmark 2024',
          confidence: 0.8,
          date: '2024-06-15',
          hasAttribution: true,
        },
      ],
      inputs: [],
      outputs: ['node-001'],
    },
  },
  edges: {
    'edge-001': {
      id: 'edge-001',
      source: 'node-002',
      target: 'node-001',
      type: 'input',
    },
    'edge-002': {
      id: 'edge-002',
      source: 'node-003',
      target: 'node-001',
      type: 'input',
    },
  },
  computedAt: MOCK_TIMESTAMP,
  globalMetrics: {
    npv: 2500000,
    roi: 0.35,
    paybackMonths: 18,
    confidence: 0.85,
    defensibilityScore: 0.87,
  },
  evidenceCoverage: 0.92,
};

async function fetchGraph(graphId: string): Promise<Graph> {
  // Simulated API call
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_GRAPH;
}

export function useGraphData(graphId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['graph', graphId],
    queryFn: () => fetchGraph(graphId || 'default'),
    enabled: !!graphId,
  });

  return {
    graph: data,
    isLoading,
    error,
    refetch,
  };
}
