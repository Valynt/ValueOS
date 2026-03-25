/**
 * IntegrityDashboard
 *
 * Page view for integrity checking: readiness gauge, evidence gaps, plausibility flags.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.3
 */

import { AlertCircle, CheckCircle2, Shield } from "lucide-react";
import React from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvidenceGaps, usePlausibility, useReadiness } from "@/hooks/useIntegrity";
import { useI18n } from "@/i18n/I18nProvider";

export function IntegrityDashboard() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useI18n();

  const { data: readiness, isLoading: readinessLoading, error: readinessError } = useReadiness(caseId);
  const { data: evidenceGaps, isLoading: gapsLoading } = useEvidenceGaps(caseId);
  const { data: plausibility, isLoading: plausibilityLoading, error: plausibilityError } = usePlausibility(caseId);

  const isLoading = readinessLoading || gapsLoading || plausibilityLoading;
  const error = readinessError || plausibilityError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("integrity.title")} — {t("errors.loadFailed")}</AlertTitle>
        <AlertDescription>{error?.message || t("errors.generic")}</AlertDescription>
      </Alert>
    );
  }

  if (!readiness && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <EmptyState
          icon={Shield}
          title={t("integrity.noData")}
          description={t("integrity.noDataDescription")}
        />
      </div>
    );
  }

  const readinessWidget: SDUIWidget = {
    id: "readiness-gauge",
    componentType: "readiness-gauge",
    props: { compositeScore: readiness?.compositeScore ?? 0, status: readiness?.status ?? "draft", components: readiness?.components, blockers: readiness?.blockers ?? [] },
  };

  const evidenceGapWidget: SDUIWidget = {
    id: "evidence-gap-list",
    componentType: "evidence-gap-list",
    props: { gaps: evidenceGaps ?? [] },
  };

  const isPresentationReady = readiness?.status === "presentation-ready";
  const blockerCount = readiness?.blockers?.length ?? 0;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Integrity Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Validate the strength of your value case before presentation
            </p>
          </div>
          {isPresentationReady ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Presentation Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full">
              <Shield className="w-5 h-5" />
              <span className="font-medium">{blockerCount} Blockers</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Status banner */}
          {isPresentationReady ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">This case is presentation-ready!</p>
                <p className="text-sm text-green-700">
                  All integrity checks passed. Proceed to generate executive outputs.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <p className="font-medium text-amber-800">Blockers Remaining</p>
              </div>
              <ul className="ml-8 space-y-1">
                {readiness?.blockers?.map((blocker, index) => (
                  <li key={index} className="text-sm text-amber-700">
                    • {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Readiness Gauge */}
          <CanvasHost widgets={[readinessWidget]} />

          {/* Two-column layout for gaps and plausibility */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CanvasHost widgets={[evidenceGapWidget]} />

            {/* Plausibility panel */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold text-lg mb-4">Plausibility Flags</h3>
              {plausibility?.flags && plausibility.flags.length > 0 ? (
                <div className="space-y-3">
                  {plausibility.flags.map((flag) => (
                    <div
                      key={flag.id}
                      className={`p-3 rounded-lg border ${flag.classification === "plausible"
                        ? "bg-green-50 border-green-200"
                        : flag.classification === "aggressive"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-red-50 border-red-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{flag.assumptionName}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${flag.classification === "plausible"
                            ? "bg-green-100 text-green-800"
                            : flag.classification === "aggressive"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                            }`}
                        >
                          {flag.classification.replace("-", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{flag.rationale}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No plausibility flags</p>
              )}

              {/* Benchmark context */}
              {plausibility?.benchmarkContext && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Benchmark Context</p>
                  <p className="text-sm">
                    {plausibility.benchmarkContext.industry} •{" "}
                    {plausibility.benchmarkContext.companySize}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrityDashboard;
