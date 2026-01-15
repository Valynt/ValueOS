/**
 * Deals View - Main Sales Enablement Interface
 *
 * Primary view for sales reps to manage deals and generate business cases.
 * Replaces generic chat interface with deal-centric workflow.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DealImportModal } from "@/components/Deals/DealImportModal";
import { DealSelector } from "@/components/Deals/DealSelector";
import { LifecycleStageNav } from "@/components/Deals/LifecycleStageNav";
import { BusinessCaseGenerator } from "@/components/Deals/BusinessCaseGenerator";
import {
  type BuyerPersona,
  PersonaSelector,
} from "@/components/Deals/PersonaSelector";
import { OpportunityAnalysisPanel } from "@/components/Deals/OpportunityAnalysisPanel";
import { BenchmarkComparisonPanel } from "@/components/Deals/BenchmarkComparisonPanel";
import { type ValueCase, valueCaseService } from "@/services/ValueCaseService";
import { ShareCustomerButton } from "@/components/Deals/ShareCustomerButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/Common/Toast";
import { logger } from "@/lib/logger";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import type { LifecycleStage } from "@/types/vos";
import { useAuth } from "@/contexts/AuthContext";
import { useExport } from "@/utils/export";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function DealsView() {
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId?: string }>();
  const { user } = useAuth();
  const { error: errorToast } = useToast();
  const { exportElement, exportData, isExporting } = useExport();

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<ValueCase | null>(null);
  const [currentStage, setCurrentStage] =
    useState<LifecycleStage>("opportunity");
  const [selectedPersona, setSelectedPersona] = useState<
    BuyerPersona | undefined
  >();
  const [businessCase, setBusinessCase] = useState<any>(null);
  const [stageCompletion, setStageCompletion] = useState<
    Partial<Record<LifecycleStage, boolean>>
  >({});

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
    }
  }, [dealId]);

  const loadDeal = async (id: string) => {
    try {
      const deals = await valueCaseService.getValueCases();
      const deal = deals.find((d) => d.id === id);
      if (deal) {
        setSelectedDeal(deal);
        setCurrentStage(deal.stage);

        // Load persona from metadata if exists
        if (deal.metadata?.persona) {
          setSelectedPersona(deal.metadata.persona as BuyerPersona);
        }
      }
    } catch (error) {
      logger.error("Failed to load deal", error as Error);
    }
  };

  const handleDealImported = (newDealId: string) => {
    navigate(`/deals/${newDealId}`);
    loadDeal(newDealId);
  };

  const handleSelectDeal = (id: string) => {
    navigate(`/deals/${id}`);
  };

  const handleStageChange = async (stage: LifecycleStage) => {
    setCurrentStage(stage);

    // Update deal stage in database
    if (selectedDeal) {
      try {
        await valueCaseService.updateValueCase(selectedDeal.id, { stage });
      } catch (error) {
        logger.error("Failed to update deal stage", error as Error);
      }
    }
  };

  const handlePersonaSelect = async (persona: BuyerPersona) => {
    setSelectedPersona(persona);

    // Save persona to deal metadata
    if (selectedDeal) {
      try {
        await valueCaseService.updateValueCase(selectedDeal.id, {
          metadata: {
            ...selectedDeal.metadata,
            persona,
          },
        });
      } catch (error) {
        logger.error("Failed to save persona", error as Error);
      }
    }
  };

  const handleBusinessCaseComplete = (generatedCase: any) => {
    setBusinessCase(generatedCase);
    setStageCompletion((prev) => ({
      ...prev,
      opportunity: true,
      target: true,
    }));
  };

  const handleBusinessCaseError = (error: string) => {
    logger.error("Business case generation error", new Error(error));
    errorToast("Business case generation failed", error || "Please try again.");
  };

  const getExportData = () => {
    if (!businessCase) return [];
    const rows = [];

    // Financials
    if (businessCase.financial) {
      rows.push({ Category: "Financial", Metric: "ROI", Value: `${businessCase.financial.roi}%` });
      if (businessCase.financial.npv) {
        rows.push({ Category: "Financial", Metric: "NPV", Value: businessCase.financial.npv });
      }
      if (businessCase.financial.payback) {
        rows.push({ Category: "Financial", Metric: "Payback Period", Value: `${businessCase.financial.payback} months` });
      }
    }

    // Opportunity
    if (businessCase.opportunity) {
       // Flatten opportunity metrics if simple enough, or just add high level scores
       if (businessCase.opportunity.score) {
          rows.push({ Category: "Opportunity", Metric: "Score", Value: businessCase.opportunity.score });
       }
    }

    return rows;
  };

  const handleExportPDF = async () => {
    if (!selectedDeal) return;
    const filename = `${selectedDeal.company}_Business_Case`;
    await exportElement("deals-view-content", "pdf", filename);
    logger.info("Exported business case as PDF", { dealId: selectedDeal.id });
  };

  const handleExportCSV = async () => {
    if (!selectedDeal || !businessCase) return;
    const filename = `${selectedDeal.company}_Business_Case`;
    const data = getExportData();
    await exportData(data, filename, { format: "csv" });
    logger.info("Exported business case as CSV", { dealId: selectedDeal.id });
  };

  // No deal selected - show deal selector
  if (!selectedDeal) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <DealSelector
          onSelectDeal={handleSelectDeal}
          onCreateDeal={() => setShowImportModal(true)}
          selectedDealId={dealId}
        />
        <DealImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onDealImported={handleDealImported}
        />
      </div>
    );
  }

  // Deal selected - show lifecycle workflow
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/deals")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                All Deals
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedDeal.company}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedDeal.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {businessCase && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isExporting}>
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPDF}>
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      Export as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {user && (
                <ShareCustomerButton
                  valueCase={selectedDeal}
                  userId={user.id}
                />
              )}
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
              >
                New Deal
              </Button>
            </div>
          </div>

          {/* Lifecycle Navigation */}
          <LifecycleStageNav
            currentStage={currentStage}
            onStageChange={handleStageChange}
            stageCompletion={stageCompletion}
          />
        </div>
      </div>

      {/* Main Content */}
      <div id="deals-view-content" className="container mx-auto p-6 max-w-7xl">
        <Tabs
          value={currentStage}
          onValueChange={(v) => handleStageChange(v as LifecycleStage)}
        >
          {/* Discovery Stage */}
          <TabsContent value="opportunity" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Discovery Phase</h2>
              <p className="text-muted-foreground mb-6">
                Identify pain points, business objectives, and opportunity scope
              </p>

              {/* Persona Selection */}
              <div className="mb-6">
                <PersonaSelector
                  selectedPersona={selectedPersona}
                  onSelectPersona={handlePersonaSelect}
                />
              </div>

              {/* Business Case Generator */}
              {selectedPersona && (
                <BusinessCaseGenerator
                  valueCase={selectedDeal}
                  onComplete={handleBusinessCaseComplete}
                  onError={handleBusinessCaseError}
                />
              )}
            </Card>

            {/* Show Opportunity Analysis if available */}
            {businessCase?.opportunity && (
              <OpportunityAnalysisPanel analysis={businessCase.opportunity} />
            )}
          </TabsContent>

          {/* Modeling Stage */}
          <TabsContent value="target" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Modeling Phase</h2>
              <p className="text-muted-foreground mb-6">
                Build ROI model, benchmark against industry, and quantify value
              </p>

              {businessCase ? (
                <div className="space-y-6">
                  {/* Benchmark Comparison */}
                  {businessCase.benchmarks && (
                    <BenchmarkComparisonPanel
                      comparisons={businessCase.benchmarks}
                      industry={selectedDeal.metadata?.industry || "Technology"}
                      companySize={selectedDeal.metadata?.companySize}
                    />
                  )}

                  {/* Financial Metrics */}
                  {businessCase.financial && (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Financial Metrics
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-muted">
                          <p className="text-sm text-muted-foreground mb-1">
                            ROI
                          </p>
                          <p className="text-3xl font-bold text-green-600">
                            {businessCase.financial.roi}%
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted">
                          <p className="text-sm text-muted-foreground mb-1">
                            NPV
                          </p>
                          <p className="text-3xl font-bold">
                            ${businessCase.financial.npv?.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted">
                          <p className="text-sm text-muted-foreground mb-1">
                            Payback
                          </p>
                          <p className="text-3xl font-bold">
                            {businessCase.financial.payback} mo
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Complete the Discovery phase to access modeling</p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Realization Stage */}
          <TabsContent value="realization" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Realization Phase</h2>
              <p className="text-muted-foreground">
                Track value delivery and compare actual vs. predicted outcomes
              </p>
              {/* TODO: Implement realization tracking */}
            </Card>
          </TabsContent>

          {/* Expansion Stage */}
          <TabsContent value="expansion" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Expansion Phase</h2>
              <p className="text-muted-foreground">
                Identify upsell and cross-sell opportunities based on realized
                value
              </p>
              {/* TODO: Implement expansion detection */}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <DealImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onDealImported={handleDealImported}
      />
    </div>
  );
}
