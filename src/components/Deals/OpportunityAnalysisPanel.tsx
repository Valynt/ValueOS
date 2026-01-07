/**
 * Opportunity Analysis Panel
 *
 * Displays output from OpportunityAgent including pain points,
 * business objectives, and persona fit analysis.
 *
 * EXPLAINABILITY: Shows confidence scores and data sources for each finding
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  DollarSign,
  Info,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import Tooltip from "@/components/ui/tooltip";

interface PainPoint {
  category: "efficiency" | "cost" | "revenue" | "risk";
  description: string;
  severity: "high" | "medium" | "low";
  frequency: string;
  estimated_annual_cost: number;
  affected_stakeholders: string[];
  confidence?: number;
}

interface BusinessObjective {
  name: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
  owner?: string;
}

interface PersonaFit {
  score: number;
  role: string;
  seniority: string;
  decision_authority: "low" | "medium" | "high";
  fit_reasoning: string;
}

interface OpportunityAnalysis {
  opportunity_summary: string;
  persona_fit: PersonaFit;
  business_objectives: BusinessObjective[];
  pain_points: PainPoint[];
  confidence_score?: number;
  data_sources?: string[];
}

interface OpportunityAnalysisPanelProps {
  analysis: OpportunityAnalysis;
  onEdit?: () => void;
}

const categoryColors = {
  efficiency: "bg-blue-100 text-blue-700",
  cost: "bg-red-100 text-red-700",
  revenue: "bg-green-100 text-green-700",
  risk: "bg-yellow-100 text-yellow-700",
};

const categoryIcons = {
  efficiency: TrendingUp,
  cost: DollarSign,
  revenue: DollarSign,
  risk: AlertTriangle,
};

const severityColors = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-green-600",
};

const authorityColors = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
};

export function OpportunityAnalysisPanel({
  analysis,
  onEdit,
}: OpportunityAnalysisPanelProps) {
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Opportunity Summary
          </h3>
          {analysis.confidence_score !== undefined && (
            <Tooltip
              content={`Based on ${analysis.data_sources?.length || 0} data sources`}
            >
              <Badge variant="secondary" className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                {Math.round(analysis.confidence_score * 100)}% Confidence
              </Badge>
            </Tooltip>
          )}
        </div>
        <p className="text-muted-foreground leading-relaxed">
          {analysis.opportunity_summary}
        </p>
      </Card>

      {/* Persona Fit */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          Persona Fit Analysis
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{analysis.persona_fit.role}</p>
              <p className="text-sm text-muted-foreground">
                {analysis.persona_fit.seniority} • Decision Authority:{" "}
                <Badge
                  className={
                    authorityColors[analysis.persona_fit.decision_authority]
                  }
                  variant="secondary"
                >
                  {analysis.persona_fit.decision_authority}
                </Badge>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {Math.round(analysis.persona_fit.score * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Fit Score</p>
            </div>
          </div>
          <Progress value={analysis.persona_fit.score * 100} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {analysis.persona_fit.fit_reasoning}
          </p>
        </div>
      </Card>

      {/* Business Objectives */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          Strategic Business Objectives
        </h3>
        <div className="space-y-3">
          {analysis.business_objectives.map((objective, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      Priority {objective.priority}
                    </Badge>
                    <h4 className="font-semibold">{objective.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {objective.description}
                  </p>
                  {objective.owner && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Owner: {objective.owner}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pain Points */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-primary" />
          Quantified Pain Points
        </h3>
        <div className="space-y-3">
          {analysis.pain_points.map((pain, index) => {
            const CategoryIcon = categoryIcons[pain.category];

            return (
              <div
                key={index}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${categoryColors[pain.category]}`}
                  >
                    <CategoryIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={categoryColors[pain.category]}
                            variant="secondary"
                          >
                            {pain.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={severityColors[pain.severity]}
                          >
                            {pain.severity} severity
                          </Badge>
                          {pain.confidence !== undefined && (
                            <Tooltip content="Confidence in cost estimate">
                              <Badge variant="secondary" className="text-xs">
                                {Math.round(pain.confidence * 100)}% confidence
                              </Badge>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-sm font-medium mb-1">
                          {pain.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Frequency: {pain.frequency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">
                          ${pain.estimated_annual_cost.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Annual Cost
                        </p>
                      </div>
                    </div>
                    {pain.affected_stakeholders.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Affects: {pain.affected_stakeholders.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Annual Cost */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Total Estimated Annual Cost</p>
            <p className="text-2xl font-bold text-red-600">
              $
              {analysis.pain_points
                .reduce((sum, p) => sum + p.estimated_annual_cost, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Data Sources */}
      {analysis.data_sources && analysis.data_sources.length > 0 && (
        <Card className="p-4 bg-muted/50">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            ANALYSIS BASED ON:
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.data_sources.map((source, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
