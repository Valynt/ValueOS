# Hook Patterns for Live Data Wiring

Three patterns used in this codebase, ordered by complexity.

## Table of Contents
1. [Direct Supabase hook](#1-direct-supabase-hook)
2. [API hook with static fallback](#2-api-hook-with-static-fallback)
3. [Fetch-and-transform hook](#3-fetch-and-transform-hook)

---

## 1. Direct Supabase hook

Use when: the view reads a first-class domain table (cases, opportunities, profiles).

```ts
// hooks/useCases.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { CasesService } from "@/lib/supabase/cases";

export function useCasesList() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["cases", tenantId],
    queryFn: () => CasesService.listCases(tenantId!),
    enabled: !!tenantId,          // never fires without tenant context
    staleTime: 30_000,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: (input: Omit<ValueCaseInsert, "tenant_id">) =>
      CasesService.createCase({ ...input, tenant_id: tenantId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", tenantId] });
    },
  });
}
```

**View consumption pattern:**
```tsx
const { data: cases, isLoading } = useCasesList();
const allCases = (cases ?? []).filter((c) => c.status !== "archived");

// Always handle three states: loading, empty, populated
{isLoading ? <SkeletonGrid /> : allCases.length === 0 ? <EmptyState /> : allCases.map(...)}
```

**Derive display fields from DB rows — never store derived state:**
```ts
// Good: pure functions, no useState
function deriveStage(c: ValueCaseWithRelations): string {
  const s = c.stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "Discovery";
  // ...
  return "Discovery"; // always return a default
}

// Bad: storing derived data in state
const [stage, setStage] = useState(deriveStage(c)); // unnecessary
```

---

## 2. API hook with static fallback

Use when: the backend has a per-item endpoint but no list endpoint, or when the data is semi-static (agent registry, domain packs, feature flags).

```ts
// hooks/useAgentMetrics.ts

// Static registry — source of truth for display metadata
export const AGENT_REGISTRY: AgentInfo[] = [
  { id: "opportunity", name: "Opportunity Agent", type: "discovery", ... },
  // ...
];

async function fetchAgentInfo(agentId: string): Promise<Partial<AgentInfo>> {
  const res = await apiClient.get<{ data: ModelCardResponse }>(
    `/api/agents/${agentId}/info`
  );
  if (!res.success || !res.data?.data) return {}; // graceful empty on failure
  const mc = res.data.data.model_card;
  return { modelVersion: mc.model_version, ... };
}

export function useAgentList() {
  return useQuery({
    queryKey: ["agent-list"],
    queryFn: async () => {
      const enriched = await Promise.allSettled(
        AGENT_REGISTRY.map(async (agent) => {
          try {
            const extra = await fetchAgentInfo(agent.id);
            return { ...agent, ...extra };   // merge: static base + API overlay
          } catch {
            return agent;                    // fallback to static on any error
          }
        })
      );
      return enriched.map((r, i) =>
        r.status === "fulfilled" ? r.value : AGENT_REGISTRY[i]!
      );
    },
    staleTime: 5 * 60_000,
    placeholderData: AGENT_REGISTRY,  // show static data immediately while fetching
  });
}
```

**Key decisions:**
- `Promise.allSettled` — one failed enrichment doesn't break the whole list
- `placeholderData` — static registry renders instantly; enrichment arrives silently
- Merge order: `{ ...staticBase, ...apiOverlay }` — API wins on conflict

---

## 3. Fetch-and-transform hook

Use when: the backend returns a different shape than the frontend type requires (e.g., flat list → graph, rows → tree, raw metrics → display model).

```ts
// features/living-value-graph/hooks/useGraphData.ts

// Backend row shape (mirrors DB schema)
interface ValueTreeNodeRow {
  id: string;
  parent_id: string | null;
  label: string;
  driver_type: string | null;
  impact_estimate: number | null;
  confidence: number | null;
  // ...
}

// Transform: flat rows → Graph type the canvas expects
function transformToGraph(caseId: string, rows: ValueTreeNodeRow[]): Graph {
  if (rows.length === 0) return emptyGraph(caseId);

  const nodes: Record<string, ValueNode> = {};
  const edges: Record<string, ValueEdge> = {};

  // 1. Build node map
  for (const row of rows) {
    nodes[row.id] = {
      id: row.id,
      type: driverTypeToNodeType(row.driver_type),
      label: row.label,
      value: row.impact_estimate ?? undefined,
      // ...
    };
  }

  // 2. Derive edges from parent_id relationships
  let edgeIdx = 0;
  for (const row of rows) {
    if (row.parent_id && nodes[row.parent_id]) {
      const edgeId = `edge-${edgeIdx++}`;
      edges[edgeId] = { id: edgeId, source: row.id, target: row.parent_id, type: "input" };
      // maintain adjacency lists on both nodes
      nodes[row.id]!.outputs = [...(nodes[row.id]!.outputs ?? []), row.parent_id];
      nodes[row.parent_id]!.inputs = [...(nodes[row.parent_id]!.inputs ?? []), row.id];
    }
  }

  // 3. Compute aggregate metrics
  const confidences = rows.map((r) => r.confidence ?? 0).filter((c) => c > 0);
  const avgConf = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0;

  return { id: `graph-${caseId}`, nodes, edges, globalMetrics: { confidence: avgConf, ... } };
}

// Always define an empty/placeholder shape — never return undefined
function emptyGraph(caseId: string): Graph {
  return { id: `graph-${caseId}`, nodes: {}, edges: {}, globalMetrics: { ... } };
}

export function useGraphData(caseId?: string) {
  return useQuery({
    queryKey: ["graph", caseId],
    queryFn: () => fetchGraph(caseId!),
    enabled: !!caseId,
    staleTime: 30_000,
    placeholderData: caseId ? emptyGraph(caseId) : undefined,
  });
}
```

**Key decisions:**
- `placeholderData` with `emptyGraph` — canvas renders immediately with empty state, no null-check needed in the component
- Transform is a pure function — easy to unit test independently of the hook
- `emptyGraph` is the canonical null object — components never need to handle `undefined`

---

## Loading / Empty State Checklist

Every view that consumes a data hook must handle all three states:

| State | Pattern |
|---|---|
| Loading | Skeleton components that match the shape of real content (same grid, same card size) |
| Empty | Contextual empty state with a clear call-to-action (not just "No data") |
| Error | Inline error message near the affected section, not a full-page error |

```tsx
// Skeleton: match real card dimensions exactly
function CardSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-40 bg-zinc-200 rounded mb-3" />
      <div className="h-9 bg-zinc-50 rounded-xl border border-zinc-100" />
    </div>
  );
}

// Empty: actionable, not just informational
function EmptyState() {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-zinc-400" />
      </div>
      <p className="text-[14px] font-medium text-zinc-700 mb-1">No cases yet</p>
      <p className="text-[13px] text-zinc-400">Enter a company name above to start.</p>
    </div>
  );
}
```
