/**
 * ValueModelWorkbench
 *
 * Page view for value modeling: hypotheses, assumptions, scenarios, sensitivity tabs.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.2
 */

import { AlertCircle } from "lucide-react";
import React, { useState } from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAcceptHypothesis,
  useAssumptions,
  useHypotheses,
  useRejectHypothesis,
  useScenarios,
  useSensitivity,
} from "@/hooks/useValueModeling";
import { useI18n } from "@/i18n/I18nProvider";

export function ValueModelWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState("hypotheses");
  const { t } = useI18n();

  const { data: hypotheses, isLoading: hypothesesLoading, error: hypothesesError } = useHypotheses(caseId);
  const { data: assumptions, isLoading: assumptionsLoading, error: assumptionsError } = useAssumptions(caseId);
  const { data: scenarios, isLoading: scenariosLoading, error: scenariosError } = useScenarios(caseId);
  const { data: sensitivity, isLoading: sensitivityLoading, error: sensitivityError } = useSensitivity(caseId);

  const acceptHypothesis = useAcceptHypothesis();
  const rejectHypothesis = useRejectHypothesis();

  const handleWidgetAction = (widgetId: string, action: string, payload?: unknown) => {
    if (action === "accept") {
      const { hypothesisId } = payload as { hypothesisId: string };
      if (caseId) acceptHypothesis.mutate({ caseId, hypothesisId });
    } else if (action === "reject") {
      const { hypothesisId } = payload as { hypothesisId: string };
      if (caseId) rejectHypothesis.mutate({ caseId, hypothesisId });
    }
  };

  const isLoading = hypothesesLoading || assumptionsLoading || scenariosLoading || sensitivityLoading;
  const error = hypothesesError || assumptionsError || scenariosError || sensitivityError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("valueModel.title")} — {t("errors.loadFailed")}</AlertTitle>
        <AlertDescription>{error?.message || t("errors.generic")}</AlertDescription>
      </Alert>
    );
  }

  const hypothesesWidget: SDUIWidget = {
    id: "hypothesis-cards",
    componentType: "hypothesis-card",
    props: { hypotheses: hypotheses ?? [] },
  };

  const assumptionsWidget: SDUIWidget = {
    id: "assumption-register",
    componentType: "assumption-register",
    props: { assumptions: assumptions ?? [] },
  };

  const scenariosWidget: SDUIWidget = {
    id: "scenario-comparison",
    componentType: "scenario-comparison",
    props: { scenarios: scenarios ?? [] },
  };

  const sensitivityWidget: SDUIWidget = {
    id: "sensitivity-tornado",
    componentType: "sensitivity-tornado",
    props: { items: sensitivity?.tornadoData ?? [], baseScenario: sensitivity?.baseScenario },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-card">
        <h1 className="text-xl font-semibold">{t("valueModel.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("canvas.summary")}
        </p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="hypotheses">{t("valueModel.hypotheses")}</TabsTrigger>
            <TabsTrigger value="assumptions">{t("valueModel.assumptions")}</TabsTrigger>
            <TabsTrigger value="scenarios">{t("valueModel.scenarios")}</TabsTrigger>
            <TabsTrigger value="sensitivity">{t("valueModel.sensitivity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="hypotheses" className="mt-6">
            <CanvasHost widgets={[hypothesesWidget]} onWidgetAction={handleWidgetAction} />
          </TabsContent>

          <TabsContent value="assumptions" className="mt-6">
            <CanvasHost widgets={[assumptionsWidget]} onWidgetAction={handleWidgetAction} />
          </TabsContent>

          <TabsContent value="scenarios" className="mt-6">
            <CanvasHost widgets={[scenariosWidget]} onWidgetAction={handleWidgetAction} />
          </TabsContent>

          <TabsContent value="sensitivity" className="mt-6">
            <CanvasHost widgets={[sensitivityWidget]} onWidgetAction={handleWidgetAction} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ValueModelWorkbench;
