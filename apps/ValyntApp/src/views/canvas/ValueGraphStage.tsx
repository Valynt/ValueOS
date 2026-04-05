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
import { ArrowRightLeft, ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { ValueGraphEntityType, ValueGraphNode } from "@/api/valueGraph";
import { ValueGraphVisualization } from "@/components/sdui/ValueGraphVisualization";
import { useClaimEvidenceGraph } from "@/hooks/useClaimEvidenceGraph";
import { useValueGraph } from "@/hooks/useValueGraph";

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
  onNavigate: (entityType: ValueGraphEntityType, entityId: string) => void;
  claimEvidenceData: ReturnType<typeof useClaimEvidenceGraph>["data"];
}

function EntityInspector({ entity, onClose, onNavigate, claimEvidenceData }: EntityInspectorProps) {
  const typeLabel = ENTITY_LABELS[entity.entityType] ?? entity.entityType;

  const claimForHypothesis = useMemo(() => {
    if (entity.entityType !== "value_hypothesis") return null;
    return claimEvidenceData?.claimCentric.claims.find((c) => c.claim.id === entity.entityId) ?? null;
  }, [claimEvidenceData?.claimCentric.claims, entity.entityId, entity.entityType]);

  const evidenceForArtifact = useMemo(() => {
    if (entity.entityType !== "evidence") return null;
    return claimEvidenceData?.evidenceCentric.evidence.find((e) => e.artifact.id === entity.entityId) ?? null;
  }, [claimEvidenceData?.evidenceCentric.evidence, entity.entityId, entity.entityType]);

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-zinc-200 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{typeLabel}</span>
          <h3 className="text-sm font-semibold text-zinc-900 mt-0.5 leading-snug">
            {entity.label ?? `${entity.entityId.slice(0, 12)}…`}
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

      <div className="flex-1 p-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Entity ID</p>
          <p className="text-xs font-mono text-zinc-600 break-all">{entity.entityId}</p>
        </div>

        {entity.data &&
          Object.entries(entity.data)
            .filter(([k]) => !["id", "organization_id", "opportunity_id", "created_at", "updated_at"].includes(k))
            .map(([key, value]) => {
              if (value == null) return null;
              const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
              return (
                <div key={key}>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">{key.replace(/_/g, " ")}</p>
                  <p className="text-xs text-zinc-700 break-words">{displayValue}</p>
                </div>
              );
            })}

        {claimForHypothesis && (
          <section className="rounded-lg border border-zinc-200 p-3 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-800 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              Evidence Links
            </h4>
            <p className="text-xs text-zinc-600">{claimForHypothesis.claim.claim_text}</p>
            {claimForHypothesis.evidence_links.map((linked) => (
              <button
                key={linked.edge.id}
                className="w-full text-left rounded border border-zinc-200 p-2 hover:bg-zinc-50"
                type="button"
                onClick={() => linked.evidence && onNavigate("evidence", linked.evidence.id)}
              >
                <p className="text-xs font-medium text-zinc-800">
                  {linked.evidence?.title ?? "Missing evidence artifact"}
                </p>
                <p className="text-[11px] text-zinc-500">{linked.edge.edge_type} • {linked.edge.created_at}</p>
              </button>
            ))}
            {claimForHypothesis.latest_confidence && (
              <div className="pt-2 border-t border-zinc-100">
                <p className="text-xs text-zinc-700">
                  Confidence: {(claimForHypothesis.latest_confidence.confidence_score * 100).toFixed(0)}% • Coverage: {(claimForHypothesis.latest_confidence.evidence_coverage_score * 100).toFixed(0)}%
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {claimForHypothesis.latest_confidence.rationale ?? "No rationale provided"}
                </p>
                <ul className="mt-2 space-y-1">
                  {claimForHypothesis.confidence_history.slice(-5).map((snapshot) => (
                    <li key={snapshot.recorded_at} className="text-[11px] text-zinc-500">
                      {snapshot.recorded_at} → {(snapshot.confidence_score * 100).toFixed(0)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {evidenceForArtifact && (
          <section className="rounded-lg border border-zinc-200 p-3 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-800 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              Linked Claims
            </h4>
            <p className="text-xs text-zinc-600">
              Version {evidenceForArtifact.artifact.version_no} • {evidenceForArtifact.artifact.captured_at}
            </p>
            {evidenceForArtifact.artifact.source_uri && (
              <a
                href={evidenceForArtifact.artifact.source_uri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {evidenceForArtifact.linked_claims.map((linked) => (
              <button
                key={linked.edge.id}
                className="w-full text-left rounded border border-zinc-200 p-2 hover:bg-zinc-50"
                type="button"
                onClick={() => linked.claim && onNavigate("value_hypothesis", linked.claim.id)}
              >
                <p className="text-xs font-medium text-zinc-800">{linked.claim?.claim_text ?? "Missing claim"}</p>
                <p className="text-[11px] text-zinc-500">
                  {linked.edge.edge_type} • {(linked.latest_confidence?.confidence_score ?? 0).toFixed(2)} confidence
                </p>
              </button>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}

interface ValueGraphStageProps {
  opportunityId: string | undefined;
}

export function ValueGraphStage({ opportunityId }: ValueGraphStageProps) {
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const { data } = useValueGraph(opportunityId ?? null);
  const claimEvidence = useClaimEvidenceGraph(opportunityId ?? null);

  const handleNodeSelect = (entityType: ValueGraphEntityType, entityId: string) => {
    const node = data?.graph.nodes.find(
      (n: ValueGraphNode) => n.entity_type === entityType && n.entity_id === entityId,
    );
    const nodeData = node?.data as Record<string, unknown> | undefined;
    const label =
      (nodeData?.["name"] as string | undefined) ??
      (nodeData?.["title"] as string | undefined);

    setSelectedEntity({ entityType, entityId, label, data: nodeData });
  };

  if (!opportunityId) {
    return <div className="flex items-center justify-center h-64 text-sm text-zinc-400">No opportunity selected.</div>;
  }

  return (
    <div className="flex flex-col gap-6" data-testid="value-graph-stage">
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
            onNavigate={handleNodeSelect}
            claimEvidenceData={claimEvidence.data}
          />
        )}
      </div>

      {data && data.paths.length > 0 && (
        <section>
          <h3 className="text-[13px] font-semibold text-zinc-700 mb-3">
            Value Paths
            <span className="ml-2 text-[11px] font-normal text-zinc-400">sorted by confidence</span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.paths.map((path, idx) => (
              <ValuePathCard
                key={`${path.use_case_id}-${path.value_driver.id}-${idx}`}
                path={{
                  path_confidence: path.path_confidence,
                  use_case_id: path.use_case_id,
                  capabilities: path.capabilities.map((c) => ({ id: c.id, name: c.name })),
                  metrics: path.metrics.map((m) => ({
                    id: m.id,
                    name: m.name,
                    unit: m.unit,
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
        <p className="text-sm text-zinc-400 text-center py-6">No value paths yet. Agents will populate these as they run.</p>
      )}
    </div>
  );
}
