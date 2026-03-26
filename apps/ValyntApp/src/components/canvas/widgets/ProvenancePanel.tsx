import React from "react";

import type { WidgetProps } from "../CanvasHost";

interface ProvenanceSource {
  id: string;
  type: "benchmark" | "customer" | "internal";
  title: string;
  snippet: string;
  confidence: number;
}

interface ProvenanceClaim {
  id: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
  sources: ProvenanceSource[];
}

interface ProvenancePanelData {
  claim: ProvenanceClaim;
}

export function ProvenancePanel({ data }: WidgetProps) {
  const claim = (data as ProvenancePanelData | undefined)?.claim;

  if (!claim) {
    return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No provenance available.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-foreground">Provenance</h3>
      <p className="text-sm text-foreground">{claim.statement}</p>
      <p className="text-xs text-muted-foreground">Confidence: {Math.round(claim.confidence * 100)}%</p>
      <div className="space-y-2">
        {claim.sources.map((source) => (
          <div key={source.id} className="rounded-lg border border-border p-2">
            <p className="text-xs font-medium text-foreground">{source.title}</p>
            <p className="text-xs text-muted-foreground">{source.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
