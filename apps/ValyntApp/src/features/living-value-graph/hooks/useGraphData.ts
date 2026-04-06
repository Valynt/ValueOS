/**
 * useGraphData Hook
 *
 * Fetches value tree nodes from /api/v1/cases/:caseId/value-tree and
 * transforms the flat node list into the Graph shape the canvas expects.
 * Falls back to an empty graph when the case has no tree yet.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Graph, ValueEdge, ValueNode } from '../types/graph.types';

import { apiClient } from '@/api/client/unified-api-client';


// ---------------------------------------------------------------------------
// Backend row shape (mirrors ValueTreeNodeRow from the repository)
// ---------------------------------------------------------------------------

interface ValueTreeNodeRow {
  id: string;
  case_id: string;
  organization_id: string;
  parent_id: string | null;
  node_key: string | null;
  label: string;
  description: string | null;
  driver_type: string | null;
  impact_estimate: number | null;
  confidence: number | null;
  sort_order: number;
  source_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Transform flat node list -> Graph
// ---------------------------------------------------------------------------

function driverTypeToNodeType(dt: string | null): ValueNode['type'] {
  switch (dt) {
    case 'revenue': return 'output';
    case 'cost':
    case 'efficiency': return 'driver';
    case 'risk': return 'metric';
    default: return 'input';
  }
}

function transformToGraph(caseId: string, rows: ValueTreeNodeRow[]): Graph {
  if (rows.length === 0) return emptyGraph(caseId);

  const nodes: Record<string, ValueNode> = {};
  const edges: Record<string, ValueEdge> = {};
  let totalImpact = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const row of rows) {
    const confidence = row.confidence ?? 0;
    if (confidence > 0) {
      confidenceSum += confidence;
      confidenceCount += 1;
    }
    totalImpact += row.impact_estimate ?? 0;

    nodes[row.id] = {
      id: row.id,
      type: driverTypeToNodeType(row.driver_type),
      label: row.label,
      value: row.impact_estimate ?? undefined,
      unit: (row.metadata?.unit as string | undefined) ?? 'USD',
      confidence: row.confidence ?? undefined,
      inputs: [],
      outputs: [],
      metadata: {
        description: row.description ?? undefined,
        owner: (row.metadata?.owner as string | undefined),
        lastModified: row.updated_at,
        version: 1,
      },
    };
  }

  let edgeIdx = 0;
  for (const row of rows) {
    if (row.parent_id && nodes[row.parent_id] && nodes[row.id]) {
      const edgeId = `edge-${edgeIdx++}`;
      edges[edgeId] = { id: edgeId, source: row.id, target: row.parent_id, type: 'input' };
      const child = nodes[row.id];
      const parent = nodes[row.parent_id];
      if (child) child.outputs.push(row.parent_id);
      if (parent) parent.inputs.push(row.id);
    }
  }

  const avgConf = confidenceCount > 0
    ? confidenceSum / confidenceCount
    : 0;

  return {
    id: `graph-${caseId}`,
    versionId: null,
    scenarioId: `scenario-${caseId}`,
    nodes,
    edges,
    computedAt: new Date().toISOString(),
    globalMetrics: {
      npv: totalImpact,
      // roi and paybackMonths are omitted until the financial model snapshot is loaded.
      // The graph metrics panel should gate display on these being defined.
      roi: undefined,
      paybackMonths: undefined,
      confidence: avgConf,
      defensibilityScore: avgConf * 0.9,
    },
    evidenceCoverage: avgConf,
  };
}

function emptyGraph(caseId: string): Graph {
  return {
    id: `graph-${caseId}`,
    versionId: null,
    scenarioId: `scenario-${caseId}`,
    nodes: {},
    edges: {},
    computedAt: null,
    globalMetrics: { npv: 0, confidence: 0, defensibilityScore: 0 },
    evidenceCoverage: 0,
  };
}

async function fetchGraph(caseId: string): Promise<Graph> {
  const res = await apiClient.get<{ data: ValueTreeNodeRow[] }>(
    `/api/v1/cases/${caseId}/value-tree`
  );

  // NOT_FOUND means the case exists but has no tree yet — treat as empty, not an error.
  if (!res.success && res.error?.code === 'NOT_FOUND') return emptyGraph(caseId);

  // Any other failure should surface so React Query can populate `error`.
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? `Failed to fetch value tree for case ${caseId}`);
  }

  return transformToGraph(caseId, res.data.data ?? []);
}

export function useGraphData(caseId?: string) {
  // Memoize so emptyGraph isn't called (and new objects allocated) on every render.
  const placeholder = useMemo(
    () => (caseId ? emptyGraph(caseId) : undefined),
    [caseId]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['graph', caseId],
    queryFn: () => fetchGraph(caseId!),
    enabled: !!caseId,
    staleTime: 30_000,
    placeholderData: placeholder,
  });

  return { graph: data, isLoading, error, refetch };
}
