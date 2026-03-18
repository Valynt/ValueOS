/**
 * ExecutiveOutputStudio
 *
 * Page view for executive outputs: artifact tabs, preview, inline editing.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.4
 */

import { ProvenancePanel } from "@valueos/components/components/ProvenancePanel";
import { AlertCircle, FileText, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArtifact, useArtifacts, useGenerateArtifacts, useReadiness } from "@/hooks";


type ArtifactType = "executive-memo" | "cfo-recommendation" | "customer-narrative" | "internal-case";

const artifactTabs: { id: ArtifactType; label: string }[] = [
  { id: "executive-memo", label: "Executive Memo" },
  { id: "cfo-recommendation", label: "CFO Recommendation" },
  { id: "customer-narrative", label: "Customer Narrative" },
  { id: "internal-case", label: "Internal Case" },
];

export function ExecutiveOutputStudio() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState<ArtifactType>("executive-memo");
  const [provenanceClaimId, setProvenanceClaimId] = useState<string | undefined>();

  const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useArtifacts(caseId);
  const { data: readiness } = useReadiness(caseId);
  const generateArtifacts = useGenerateArtifacts(caseId);

  const activeArtifact = artifacts?.find((a) => a.type === activeTab);

  const isLoading = artifactsLoading;
  const error = artifactsError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load artifacts</AlertTitle>
        <AlertDescription>{error?.message || "Unknown error occurred"}</AlertDescription>
      </Alert>
    );
  }

  const hasArtifacts = artifacts && artifacts.length > 0;
  const isDraft = (readiness?.compositeScore ?? 0) < 0.8;

  const artifactWidget: SDUIWidget | null = activeArtifact
    ? {
        id: `artifact-${activeArtifact.id}`,
        componentType: "artifact-preview",
        props: { artifact: activeArtifact },
      }
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Executive Output Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate and refine artifacts for stakeholder presentations
            </p>
          </div>
          {!hasArtifacts && (
            <Button
              onClick={() => generateArtifacts.mutate()}
              disabled={generateArtifacts.isPending}
              className="flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {generateArtifacts.isPending ? "Generating..." : "Generate Artifacts"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {isDraft && hasArtifacts && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Draft Quality Warning</AlertTitle>
            <AlertDescription className="text-amber-700">
              Case readiness is below 80%. Artifacts may require additional review before
              presentation.
            </AlertDescription>
          </Alert>
        )}

        {!hasArtifacts ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No artifacts yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Generate executive artifacts to create presentation-ready content for your value case.
            </p>
            <Button
              onClick={() => generateArtifacts.mutate()}
              disabled={generateArtifacts.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateArtifacts.isPending ? "Generating..." : "Generate Artifacts"}
            </Button>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ArtifactType)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              {artifactTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {artifactTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-6">
                {activeArtifact && artifactWidget ? (
                  <CanvasHost
                    widgets={[artifactWidget]}
                    onWidgetAction={(widgetId, action, payload) => {
                      if (action === "claimClick") {
                        const { claimId } = payload as { claimId: string };
                        setProvenanceClaimId(claimId);
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No {tab.label.toLowerCase()} generated yet</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Provenance Panel */}
      <ProvenancePanel
        isOpen={!!provenanceClaimId}
        onClose={() => setProvenanceClaimId(undefined)}
        claimId={provenanceClaimId}
        nodes={[
          { id: "1", type: "source", label: "CRM Data", value: "Salesforce", timestamp: new Date().toISOString() },
          { id: "2", type: "formula", label: "ROI Calculation", value: "(Benefits - Costs) / Costs" },
          { id: "3", type: "agent", label: "ValueModelAgent", value: "v2.1.0", timestamp: new Date().toISOString() },
          { id: "4", type: "confidence", label: "Confidence Score", value: "85%", confidence: 0.85 },
        ]}
      />
    </div>
  );
}

export default ExecutiveOutputStudio;
