/**
 * BillingPage - Usage & Billing
 * 
 * Current plan, AI credits usage, usage chart.
 */

import React from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Mock data
const currentPlan = {
  name: "Team Plan",
  price: "$99",
  period: "mo",
  features: ["5 Seats Included", "Unlimited Cases"],
};

const usage = {
  current: 847,
  limit: 1000,
  resetsIn: 21,
};

const weeklyUsage = [
  { week: "Week 1", valueCases: 120, research: 45, analysis: 30 },
  { week: "Week 2", valueCases: 180, research: 85, analysis: 50 },
  { week: "Week 3", valueCases: 200, research: 120, analysis: 60 },
  { week: "Week 4", valueCases: 150, research: 80, analysis: 40 },
];

export function BillingPage() {
  const usagePercent = (usage.current / usage.limit) * 100;

  // Calculate max height for chart
  const maxValue = Math.max(
    ...weeklyUsage.map((w) => w.valueCases + w.research + w.analysis)
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 gap-6">
        {/* Current Plan Card */}
        <Card className="p-6 bg-white border border-slate-200 relative overflow-hidden">
          {/* Decorative blob */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full" />
          
          <div className="relative">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Current Plan
            </h3>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-1">{currentPlan.name}</h2>
            <div className="text-slate-500 mb-6">
              <span className="text-2xl font-bold text-slate-900">{currentPlan.price}</span>
              <span className="text-sm">/{currentPlan.period}</span>
            </div>

            <div className="space-y-2 mb-6">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={16} className="text-emerald-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Button className="w-full" variant="secondary">
              Change Plan
            </Button>
          </div>
        </Card>

        {/* AI Credits Usage Card */}
        <Card className="p-6 bg-white border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Credits Usage
            </h3>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              Resets in {usage.resetsIn} days
            </Badge>
          </div>

          {/* Usage Number */}
          <div className="mb-4">
            <span className="text-4xl font-bold text-slate-900">{usage.current}</span>
            <span className="text-slate-400 text-lg"> / {usage.limit.toLocaleString()}</span>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={usagePercent} className="h-2" />
          </div>

          {/* Usage Chart */}
          <div className="h-48 flex items-end justify-between gap-2">
            {weeklyUsage.map((week, index) => {
              const total = week.valueCases + week.research + week.analysis;
              const heightPercent = (total / maxValue) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                    style={{ height: `${heightPercent}%` }}
                  >
                    {/* Value Cases - Blue */}
                    <div 
                      className="bg-primary"
                      style={{ height: `${(week.valueCases / total) * 100}%` }}
                    />
                    {/* Research - Emerald */}
                    <div 
                      className="bg-emerald-500"
                      style={{ height: `${(week.research / total) * 100}%` }}
                    />
                    {/* Analysis - Amber */}
                    <div 
                      className="bg-amber-400"
                      style={{ height: `${(week.analysis / total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{week.week}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs text-slate-500">Value Cases</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">Research</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-500">Analysis</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default BillingPage;
