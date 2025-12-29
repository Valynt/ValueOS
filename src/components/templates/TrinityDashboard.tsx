/**
 * Trinity Dashboard with Truth Engine Integration
 * 3-pillar ROI view (Revenue, Cost Savings, Risk Reduction)
 */

import React, { useMemo } from "react";
import { MetricCard } from "../atoms/MetricCard";
import { Card } from "../atoms/Card";
import { DollarSign, TrendingDown, Shield } from "lucide-react";

export interface TrinityFinancials {
  totalValue: number;
  revenueImpact: number;
  costSavings: number;
  riskReduction: number;
  roi?: number;
  npv?: number;
  paybackPeriod?: string;
}

export interface TrinityOutcome {
  id: string;
  name: string;
  category: "revenue" | "cost" | "risk";
  impact: number;
  description?: string;
}

export interface TrinityVerification {
  overall: { passed: boolean; confidence: number };
  revenue: { passed: boolean; confidence: number; citations: string[] };
  cost: { passed: boolean; confidence: number; citations: string[] };
  risk: { passed: boolean; confidence: number; citations: string[] };
}

export interface TrinityDashboardProps {
  financials: TrinityFinancials;
  outcomes?: TrinityOutcome[];
  verification: TrinityVerification;
  showBreakdown?: boolean;
  highlightDominant?: boolean;
  className?: string;
}

export const TrinityDashboard: React.FC<TrinityDashboardProps> = ({
  financials,
  outcomes = [],
  verification,
  showBreakdown = true,
  highlightDominant = true,
  className = "",
}) => {
  // Calculate pillars with verification
  const pillars = useMemo(() => {
    const total = financials.totalValue;

    return [
      {
        id: "revenue",
        name: "Revenue Impact",
        value: financials.revenueImpact,
        percentage: total > 0 ? (financials.revenueImpact / total) * 100 : 0,
        verified: verification.revenue.passed,
        confidence: verification.revenue.confidence,
        citations: verification.revenue.citations,
        color: "emerald",
        icon: <DollarSign className="w-5 h-5" />,
        outcomes: outcomes.filter((o) => o.category === "revenue"),
      },
      {
        id: "cost",
        name: "Cost Savings",
        value: financials.costSavings,
        percentage: total > 0 ? (financials.costSavings / total) * 100 : 0,
        verified: verification.cost.passed,
        confidence: verification.cost.confidence,
        citations: verification.cost.citations,
        color: "blue",
        icon: <TrendingDown className="w-5 h-5" />,
        outcomes: outcomes.filter((o) => o.category === "cost"),
      },
      {
        id: "risk",
        name: "Risk Reduction",
        value: financials.riskReduction,
        percentage: total > 0 ? (financials.riskReduction / total) * 100 : 0,
        verified: verification.risk.passed,
        confidence: verification.risk.confidence,
        citations: verification.risk.citations,
        color: "purple",
        icon: <Shield className="w-5 h-5" />,
        outcomes: outcomes.filter((o) => o.category === "risk"),
      },
    ];
  }, [financials, outcomes, verification]);

  // Find dominant pillar
  const dominantPillar = useMemo(() => {
    return pillars.reduce((max, pillar) =>
      pillar.value > max.value ? pillar : max
    );
  }, [pillars]);

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className={`trinity-dashboard space-y-6 ${className}`}>
      {/* Header: Total Value */}
      <Card variant="elevated" className="text-center">
        <div className="mb-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Total Value
          </h2>
        </div>
        <MetricCard
          label="Combined Impact"
          value={formatCurrency(financials.totalValue)}
          verified={verification.overall.passed}
          confidence={verification.overall.confidence}
          citations={[
            ...verification.revenue.citations,
            ...verification.cost.citations,
            ...verification.risk.citations,
          ]}
          variant="primary"
          className="shadow-none border-0"
        />

        {/* Financial Metrics Row */}
        {(financials.roi || financials.npv || financials.paybackPeriod) && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
            {financials.roi !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">ROI</div>
                <div className="text-lg font-bold text-foreground">
                  {financials.roi}%
                </div>
              </div>
            )}
            {financials.npv !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">NPV</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(financials.npv)}
                </div>
              </div>
            )}
            {financials.paybackPeriod && (
              <div>
                <div className="text-xs text-muted-foreground">Payback</div>
                <div className="text-lg font-bold text-foreground">
                  {financials.paybackPeriod}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Three Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pillars.map((pillar) => {
          const isDominant =
            highlightDominant && pillar.id === dominantPillar.id;

          return (
            <Card
              key={pillar.id}
              variant={isDominant ? "bordered" : "default"}
              className={isDominant ? "ring-2 ring-primary/30" : ""}
            >
              <MetricCard
                label={pillar.name}
                value={formatCurrency(pillar.value)}
                verified={pillar.verified}
                confidence={pillar.confidence}
                citations={pillar.citations}
                subtitle={`${pillar.percentage.toFixed(0)}% of total`}
                icon={pillar.icon}
                variant={pillar.verified ? "success" : "warning"}
                className="shadow-none border-0"
              />

              {/* Outcome Breakdown */}
              {showBreakdown && pillar.outcomes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Outcomes ({pillar.outcomes.length})
                  </div>
                  {pillar.outcomes.slice(0, 3).map((outcome) => (
                    <div
                      key={outcome.id}
                      className="flex justify-between items-start text-xs hover:bg-secondary/50 p-1.5 rounded transition-colors"
                    >
                      <span className="text-foreground flex-1">
                        {outcome.name}
                      </span>
                      <span className="text-muted-foreground font-medium ml-2">
                        {formatCurrency(outcome.impact)}
                      </span>
                    </div>
                  ))}
                  {pillar.outcomes.length > 3 && (
                    <div class="text-xs text-muted-foreground text-center">
                      +{pillar.outcomes.length - 3} more
                    </div>
                  )}
                </div>
              )}

              {/* No outcomes message */}
              {showBreakdown && pillar.outcomes.length === 0 && (
                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground text-center">
                  No outcomes defined
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Verification Summary */}
      <Card variant="default" className="bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <strong>Verification Status:</strong> All metrics are{" "}
          {verification.overall.passed ? (
            <span className="text-green-600 dark:text-green-400 font-semibold">
              verified
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              pending review
            </span>
          )}{" "}
          by the Truth Engine with{" "}
          <span className="font-semibold">
            {verification.overall.confidence}% confidence
          </span>
          .
        </div>
      </Card>
    </div>
  );
};

export default TrinityDashboard;
