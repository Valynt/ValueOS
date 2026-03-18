import React, { useState } from "react";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  limits: {
    aiTokens: number;
    apiCalls: number;
    seats: number;
  };
  isCurrent: boolean;
}

export interface PlanComparisonProps {
  plans: Plan[];
  currentPlanId: string;
  onUpgrade?: (planId: string) => void;
  className?: string;
}

/**
 * PlanComparison - Side-by-side plan cards with features and upgrade CTA.
 *
 * Shows: features, pricing, current plan indicator, upgrade CTA.
 *
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.6.2
 */
export function PlanComparison({
  plans,
  currentPlanId,
  onUpgrade,
  className = "",
}: PlanComparisonProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  const formatPrice = (price: number, interval: string) => {
    return `$${price.toFixed(0)}/${interval === "year" ? "yr" : "mo"}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4">Plan Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isHovered = hoveredPlan === plan.id;

          return (
            <div
              key={plan.id}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={`relative border rounded-lg p-4 transition-all ${isCurrent
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : isHovered
                    ? "border-primary/50 shadow-md"
                    : "border-border"
                }`}
            >
              {/* Current Plan Badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Current Plan
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-4">
                <h4 className="font-semibold text-lg">{plan.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold">{formatPrice(plan.price, plan.interval)}</span>
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Tokens</span>
                  <span className="font-medium">{formatNumber(plan.limits.aiTokens)} / mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Calls</span>
                  <span className="font-medium">{formatNumber(plan.limits.apiCalls)} / mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Seats</span>
                  <span className="font-medium">{plan.limits.seats}</span>
                </div>
              </div>

              {/* Features */}
              <div className="border-t border-border pt-4 mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Features</p>
                <ul className="space-y-1.5 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2 text-sm bg-muted text-muted-foreground rounded cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : (
                (() => {
                  const currentPlan = plans.find((p) => p.id === currentPlanId);
                  const isUpgrade = currentPlan ? plan.price > currentPlan.price : plan.price > 0;
                  return (
                    <button
                      onClick={() => onUpgrade?.(plan.id)}
                      className={`w-full py-2 text-sm rounded transition-colors ${isUpgrade
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-border hover:bg-accent/50"
                        }`}
                    >
                      {isUpgrade ? "Upgrade" : "Downgrade"}
                    </button>
                  );
                })()
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
