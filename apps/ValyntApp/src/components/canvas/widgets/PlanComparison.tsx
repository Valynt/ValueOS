/**
 * PlanComparison Widget
 *
 * Side-by-side plan cards with features, pricing, current plan indicator, and upgrade CTA.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.6
 */

import { ArrowRight, Check, Star } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

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
  popular?: boolean;
}

export interface PlanComparisonData {
  plans: Plan[];
  currentPlanId: string;
}

export function PlanComparison({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as PlanComparisonData;
  const plans = widgetData.plans ?? [];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatLimit = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Star className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Plan Comparison</h3>
          <p className="text-sm text-muted-foreground">Choose the right plan for your needs</p>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No plans available</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-lg border p-5 ${plan.isCurrent
                  ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                  : plan.popular
                    ? "bg-amber-50/50 border-amber-200"
                    : "bg-card border-border"
                }`}
            >
              {/* Badges */}
              <div className="flex items-center gap-2 mb-3">
                {plan.isCurrent && (
                  <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
                    Current Plan
                  </span>
                )}
                {plan.popular && !plan.isCurrent && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
                    Popular
                  </span>
                )}
              </div>

              {/* Plan name */}
              <h4 className="font-semibold text-lg">{plan.name}</h4>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                <span className="text-muted-foreground">/{plan.interval}</span>
              </div>

              {/* Limits */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Tokens</span>
                  <span className="font-medium">{formatLimit(plan.limits.aiTokens)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Calls</span>
                  <span className="font-medium">{formatLimit(plan.limits.apiCalls)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seats</span>
                  <span className="font-medium">{plan.limits.seats}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-5">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {plan.isCurrent ? (
                <button
                  disabled
                  className="w-full py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => onAction?.("upgrade", { planId: plan.id })}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {plan.price > (plans.find((p) => p.isCurrent)?.price || 0) ? "Upgrade" : "Downgrade"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlanComparison;
