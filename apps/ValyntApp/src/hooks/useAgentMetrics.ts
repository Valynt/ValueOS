/**
 * useAgentMetrics
 *
 * Fetches per-agent model card info from /api/agents/:agentId/info.
 * Falls back to static metadata when the backend is unavailable.
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  version: string;
  active: boolean;
  description: string;
  // From model card (populated when backend responds)
  modelVersion?: string;
  trainingCutoff?: string;
  safetyConstraints?: string[];
  knownLimitations?: string[];
  // Metrics (populated from usage ledger when available)
  successRate?: number;
  runsLast7d?: number;
  costLast7d?: string;
}

// Static agent registry — source of truth for display metadata.
// Model card fields are merged in from the backend when available.
export const AGENT_REGISTRY: AgentInfo[] = [
  {
    id: "opportunity",
    name: "Opportunity Agent",
    type: "discovery",
    version: "v2.3",
    active: true,
    description: "Identifies and analyzes business opportunities from EDGAR filings, news, and market data",
  },
  {
    id: "target",
    name: "Target Agent",
    type: "modeling",
    version: "v1.8",
    active: true,
    description: "Builds value trees and quantifies target outcomes for opportunities",
  },
  {
    id: "financial-modeling",
    name: "Financial Modeling Agent",
    type: "analysis",
    version: "v3.1",
    active: true,
    description: "Generates ROI projections, business cases, and financial models",
  },
  {
    id: "integrity",
    name: "Integrity Agent",
    type: "verification",
    version: "v2.0",
    active: true,
    description: "Verifies claims against ground truth sources (EDGAR, XBRL, market data)",
  },
  {
    id: "narrative",
    name: "Narrative Agent",
    type: "content",
    version: "v1.1",
    active: true,
    description: "Generates executive summaries and presentation narratives",
  },
  {
    id: "realization",
    name: "Realization Agent",
    type: "tracking",
    version: "v1.2",
    active: true,
    description: "Tracks value delivery against targets and milestones",
  },
  {
    id: "expansion",
    name: "Expansion Agent",
    type: "growth",
    version: "v1.0",
    active: true,
    description: "Identifies upsell and cross-sell opportunities from realized value",
  },
  {
    id: "compliance-auditor",
    name: "Compliance Auditor",
    type: "verification",
    version: "v1.0",
    active: true,
    description: "Audits control coverage and generates compliance summaries",
  },
];

interface ModelCardResponse {
  agent_id: string;
  model_card: {
    model_version: string;
    training_cutoff: string;
    safety_constraints: string[];
    known_limitations: string[];
  };
}

async function fetchAgentInfo(agentId: string): Promise<Partial<AgentInfo>> {
  const res = await apiClient.get<{ data: ModelCardResponse }>(`/api/agents/${agentId}/info`);
  if (!res.success || !res.data?.data) return {};
  const mc = res.data.data.model_card;
  return {
    modelVersion: mc.model_version,
    trainingCutoff: mc.training_cutoff,
    safetyConstraints: mc.safety_constraints,
    knownLimitations: mc.known_limitations,
  };
}

/** Fetch model card for a single agent. */
export function useAgentInfo(agentId: string) {
  const base = AGENT_REGISTRY.find((a) => a.id === agentId);

  const { data: extra } = useQuery({
    queryKey: ["agent-info", agentId],
    queryFn: () => fetchAgentInfo(agentId),
    // Only fetch if the agent exists in the registry — avoids a guaranteed 404
    // for unknown IDs and prevents wasted requests when base is undefined.
    enabled: !!base,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!base) return null;
  return { ...base, ...extra };
}

/** Return the full agent list, enriched with model card data where available. */
export function useAgentList() {
  return useQuery({
    queryKey: ["agent-list"],
    queryFn: async () => {
      const enriched = await Promise.allSettled(
        AGENT_REGISTRY.map(async (agent) => {
          try {
            const extra = await fetchAgentInfo(agent.id);
            return { ...agent, ...extra };
          } catch {
            return agent;
          }
        })
      );
      return enriched.map((r, i) =>
        r.status === "fulfilled" ? r.value : AGENT_REGISTRY[i]!
      );
    },
    staleTime: 5 * 60_000,
    // On failure, fall back to static registry
    placeholderData: AGENT_REGISTRY,
  });
}
