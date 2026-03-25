/**
 * ValueGraphStage
 *
 * The "Value Graph" tab content rendered inside ValueCaseCanvas.
 * Composes:
 *   - ValueGraphVisualization (ReactFlow canvas, top section)
 *   - ValuePathCard list (sorted by path_confidence, bottom section)
 *   - Right-side entity inspector panel (shown on node click)
 *
 * Sprint 50: Initial implementation.
 */

import { ValuePathCard } from "@valueos/sdui";
import { X } from "lucide-react";
import { useState } from "react";

import type { ValueGraphEntityType, ValueGraphNode } from "@/api/valueGraph";
import { ValueGraphVisualization } from "@/components/sdui/ValueGraphVisualization";
import { useValueGraph } from "@/hooks/useValueGraph";

// ---------------------------------------------------------------------------
// Entity inspector panel
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<ValueGraphEntityType, string> = {
  account: "Account",
  stakeholder: "Stakeholder",
  use_case: "Use Case",
  vg_capability: "Capability",
  vg_metric: "Metric",
  vg_value_driver: "Value Driver",
  evidence: "Evidence",
  value_hypothesis: "Hypothesis",
};

interface SelectedEntity {
  entityType: ValueGraphEntityType;
  entityId: string;
  label?: string;
  data?: Record<string, unknown>;
}

interface EntityInspectorProps {
  entity: SelectedEntity;
  onClose: () => void;
}

function EntityInspector({ entity, onClose }: EntityInspectorProps) {
  const typeLabel = ENTITY_LABELS[entity.entityType] ?? entity.entityType;

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-zinc-200 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900 mt-0.5 leading-snug">
            {entity.label ?? entity.entityId.slice(0, 12) + "…"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Entity data */}
      <div className="flex-1 p-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">
            Entity ID
          </p>
          <p className="text-xs font-mono text-zinc-600 break-all">{entity.entityId}</p>
        </div>

        {entity.data &&
          Object.entries(entity.data)
            .filter(
              ([k]) =>
                !["id", "organization_id", "opportunity_id", "created_at", "updated_at"].includes(k)
            )
            .map(([key, value]) => {
              if (value == null) return null;
              const displayValue =
                typeof value === "object" ? JSON.stringify(value) : String(value);
              return (
                <div key={key}>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-zinc-700 break-words">{displayValue}</p>
                </div>
              );
            })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ValueGraphStageProps {
  opportunityId: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ValueGraphStage({ opportunityId }: ValueGraphStageProps) {
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const { data } = useValueGraph(opportunityId ?? null);

  const handleNodeSelect = (
    entityType: ValueGraphEntityType,
    entityId: string
  ) => {
    // Resolve label and data from the graph nodes
    const node = data?.graph.nodes.find(
      (n: ValueGraphNode) => n.entity_type === entityType && n.entity_id === entityId
    );
    const nodeData = node?.data as Record<string, unknown> | undefined;
    const label =
      (nodeData?.["name"] as string | undefined) ??
      (nodeData?.["title"] as string | undefined);

    setSelectedEntity({ entityType, entityId, label, data: nodeData });
  };

  if (!opportunityId) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-zinc-400">
        No opportunity selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="value-graph-stage">
      {/* Graph canvas + inspector row */}
      <div className="flex gap-0 rounded-xl border border-zinc-200 overflow-hidden" style={{ height: 500 }}>
        <div className="flex-1 min-w-0">
          <ValueGraphVisualization
            opportunityId={opportunityId}
            onNodeSelect={handleNodeSelect}
            className="h-full"
          />
        </div>
        {selectedEntity && (
          <EntityInspector
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />
        )}
      </div>

      {/* Value paths list */}
      {data && data.paths.length > 0 && (
        <section>
          <h3 className="text-[13px] font-semibold text-zinc-700 mb-3">
            Value Paths
            <span className="ml-2 text-[11px] font-normal text-zinc-400">
              sorted by confidence
            </span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.paths.map((path, idx) => (
              <ValuePathCard
                key={`${path.use_case_id}-${path.value_driver.id}-${idx}`}
                path={{
                  path_confidence: path.path_confidence,
                  use_case_id: path.use_case_id,
                  capabilities: path.capabilities.map((c) => ({
                    id: c.id,
                    name: c.name,
                  })),
                  metrics: path.metrics.map((m) => ({
                    id: m.id,
                    name: m.name,
                    unit: m.unit,
                    // evidence_tier and evidence_source_url are resolved
                    // server-side in a future sprint; pass undefined for now
                    // so ValuePathCard can render chips when data is present.
                    evidence_tier: undefined,
                    evidence_source_url: undefined,
                  })),
                  value_driver: {
                    id: path.value_driver.id,
                    name: path.value_driver.name,
                    type: path.value_driver.type,
                    estimated_impact_usd: path.value_driver.estimated_impact_usd,
                  },
                }}
              />
            ))}
          </div>
        </section>
      )}

      {data && data.paths.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-6">
          No value paths yet. Agents will populate these as they run.
        </p>
      )}
    </div>
  );
}
