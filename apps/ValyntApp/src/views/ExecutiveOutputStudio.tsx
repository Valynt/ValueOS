/**
 * ExecutiveOutputStudio
 *
 * Page view for executive outputs: artifact tabs, preview, inline editing.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.4
 */

import { useQuery } from "@tanstack/react-query";
import { ProvenancePanel } from "@valueos/components/components/ProvenancePanel";
import { AlertCircle, Download, FileSpreadsheet, FileText, Lock, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiClient } from "@/api/client/unified-api-client";
import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { ExportHistoryPanel } from "@/components/ExportHistoryPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArtifact, useArtifacts, useGenerateArtifacts, useReadiness } from "@/hooks";
import { useAsyncExport, useExportJobStatus } from "@/hooks/useExportJobs";
import { usePdfExport } from "@/hooks/useCaseExport";
import { buildTenantPath, safeNavigate } from "@/lib/safeNavigation";


type ArtifactType = "executive-memo" | "cfo-recommendation" | "customer-narrative" | "internal-case";

const artifactTabs: { id: ArtifactType; label: string }[] = [
  { id: "executive-memo", label: "Executive Memo" },
  { id: "cfo-recommendation", label: "CFO Recommendation" },
  { id: "customer-narrative", label: "Customer Narrative" },
  { id: "internal-case", label: "Internal Case" },
];

interface GateStatus {
  canAdvance: boolean;
  gate: {
    integrityScore: number;
    threshold: number;
    passed: boolean;
  };
  violations: {
    critical: number;
    warnings: number;
    blocked: boolean;
  };
  remediationInstructions?: string[];
}

function useIntegrityGate(caseId: string | undefined) {
  return useQuery<GateStatus>({
    queryKey: ["integrity-gate", caseId],
    queryFn: async () => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.get<{ success: boolean; data: GateStatus }>(
        `/api/v1/cases/${caseId}/gate`
      );
      if (!res.success || !res.data) {
        throw new Error("Failed to check integrity gate");
      }
      return res.data.data;
    },
    enabled: !!caseId,
  });
}

export function ExecutiveOutputStudio() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState<ArtifactType>("executive-memo");
  const [provenanceClaimId, setProvenanceClaimId] = useState<string | undefined>();
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeExportJobId, setActiveExportJobId] = useState<string | null>(null);

  const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useArtifacts(caseId);
  const { data: readiness } = useReadiness(caseId);
  const { data: gateStatus } = useIntegrityGate(caseId);
  const generateArtifacts = useGenerateArtifacts(caseId);
  const pdfExport = usePdfExport(caseId);
  const asyncExport = useAsyncExport(caseId);

  // Track active async export job
  const { data: activeJob } = useExportJobStatus(caseId, activeExportJobId ?? undefined, {
    enabled: !!activeExportJobId,
  });

  const activeArtifact = artifacts?.find((a) => a.type === activeTab);

  const isLoading = artifactsLoading;
  const error = artifactsError;

  const handlePdfExport = () => {
    setExportError(null);

    // Check integrity gate before export
    if (!gateStatus?.canAdvance) {
      setExportError(
        gateStatus?.remediationInstructions?.join(" ") ??
        "Integrity check failed. Please resolve issues before exporting."
      );
      return;
    }

    const baseUrl = window.location.origin;
    const renderUrl = `${baseUrl}/org/${caseId}/outputs?pdf=true`;

    pdfExport.mutate(
      { renderUrl, title: `Business Case - ${caseId}` },
      {
        onError: (err) => {
          if (err.message.includes("Integrity check failed") || err.message.includes("below the required")) {
            setExportError(err.message);
          }
        },
      }
    );
  };

  const handleAsyncExport = async (format: "pdf" | "pptx") => {
    setExportError(null);

    // Check integrity gate before export
    if (!gateStatus?.canAdvance) {
      setExportError(
        gateStatus?.remediationInstructions?.join(" ") ??
        "Integrity check failed. Please resolve issues before exporting."
      );
      return;
    }

    try {
      const result = await asyncExport.mutateAsync({
        format,
        exportType: "full",
        title: `Business Case - ${caseId}`,
        ownerName: undefined,
        renderUrl: format === "pdf" ? `${window.location.origin}/org/${caseId}/outputs?pdf=true` : undefined,
      });

      setActiveExportJobId(result.jobId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    }
  };

  // Clear active job when completed or failed
  useEffect(() => {
    if (activeJob?.status === "completed" && activeJob.signedUrl) {
      window.open(activeJob.signedUrl, "_blank", "noopener,noreferrer");
      setActiveExportJobId(null);
    } else if (activeJob?.status === "failed") {
      setExportError(activeJob.errorMessage ?? "Export failed");
      setActiveExportJobId(null);
    }
  }, [activeJob]);
  const integrityScore = gateStatus?.gate.integrityScore ?? 0;
  const integrityThreshold = gateStatus?.gate.threshold ?? 0.6;

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

  const canExportPdf = gateStatus?.canAdvance ?? false;

  // Show progress if async export is active
  const showExportProgress = activeExportJobId && activeJob && activeJob.status === "running";

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
          <div className="flex items-center gap-3">
            {hasArtifacts && (
              <>
                {showExportProgress ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-700">
                      {activeJob?.currentStep ?? "Exporting..."}
                      {activeJob?.progressPercent !== undefined && (
                        <span className="ml-2">({activeJob.progressPercent}%)</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => handleAsyncExport("pptx")}
                      disabled={asyncExport.isPending || !canExportPdf}
                      variant="outline"
                      className="flex items-center gap-2"
                      title={!canExportPdf ? "Resolve integrity issues before exporting" : undefined}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {asyncExport.isPending ? "Queueing..." : "Export PPTX"}
                    </Button>
                    <Button
                      onClick={handlePdfExport}
                      disabled={pdfExport.isPending || !canExportPdf}
                      variant="outline"
                      className="flex items-center gap-2"
                      title={!canExportPdf ? "Resolve integrity issues before exporting" : undefined}
                    >
                      <Download className="w-4 h-4" />
                      {pdfExport.isPending ? "Exporting..." : "Export PDF"}
                    </Button>
                  </>
                )}
              </>
            )}
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
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {exportError && (
          <Alert variant="destructive" className="mb-6">
            <Lock className="h-4 w-4" />
            <AlertTitle>Export Blocked</AlertTitle>
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        )}

        {!canExportPdf && hasArtifacts && !showExportProgress && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <Lock className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Integrity Gate Closed</AlertTitle>
            <AlertDescription className="text-red-700">
              Integrity score {(integrityScore * 100).toFixed(0)}% is below the required {(integrityThreshold * 100).toFixed(0)}% threshold.
              {gateStatus?.violations.critical ? ` ${gateStatus.violations.critical} critical violation(s) must be resolved.` : ""}
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-300 hover:bg-red-100"
                  onClick={() => {
                    const safePath = buildTenantPath(caseId ?? "", "workspace");
                    if (safePath) {
                      safeNavigate(safePath, { fallback: "/dashboard" });
                    }
                  }}
                >
                  Run Integrity Check
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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

        {/* Export History Panel - P1 */}
        {hasArtifacts && (
          <div className="mb-6">
            <ExportHistoryPanel caseId={caseId} />
          </div>
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
