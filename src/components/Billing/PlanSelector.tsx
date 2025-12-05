/**
 * Plan Selector Component
 * Displays pricing tiers and allows plan selection
 */

import React, { useState } from 'react';
import { Check, Zap, TrendingUp } from 'lucide-react';
import { PlanTier, PLANS, formatMetricName, formatUsageAmount } from '../../config/billing';

interface PlanSelectorProps {
  currentPlan?: PlanTier;
  onSelectPlan: (plan: PlanTier) => void;
  loading?: boolean;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({
  currentPlan,
  onSelectPlan,
  loading = false,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);

  const handleSelect = (tier: PlanTier) => {
    setSelectedPlan(tier);
    onSelectPlan(tier);
  };

  const getPlanIcon = (tier: PlanTier) => {
    switch (tier) {
      case 'free':
        return <Zap className="w-8 h-8 text-blue-500" />;
      case 'standard':
        return <TrendingUp className="w-8 h-8 text-purple-500" />;
      case 'enterprise':
        return <Check className="w-8 h-8 text-green-500" />;
    }
  };

  const getPlanColor = (tier: PlanTier) => {
    switch (tier) {
      case 'free':
        return 'border-blue-500';
      case 'standard':
        return 'border-purple-500';
      case 'enterprise':
        return 'border-green-500';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Object.entries(PLANS).map(([tier, plan]) => {
        const isCurrentPlan = currentPlan === tier;
        const isSelected = selectedPlan === tier;

        return (
          <div
            key={tier}
            className={`
              relative rounded-lg border-2 p-6 transition-all
              ${isCurrentPlan ? `${getPlanColor(tier as PlanTier)} shadow-lg` : 'border-gray-200'}
              ${isSelected ? 'shadow-xl scale-105' : 'hover:shadow-md'}
            `}
          >
            {isCurrentPlan && (
              <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg">
                Current Plan
              </div>
            )}

            <div className="flex flex-col items-center mb-4">
              {getPlanIcon(tier as PlanTier)}
              <h3 className="text-2xl font-bold mt-2">{plan.name}</h3>
              <p className="text-gray-600 text-sm">{plan.description}</p>
            </div>

            <div className="text-center mb-6">
              <div className="text-4xl font-bold">
                ${plan.price}
                <span className="text-lg text-gray-600">/mo</span>
              </div>
            </div>

            {/* Quotas */}
            <div className="space-y-2 mb-6">
              <div className="text-sm font-semibold text-gray-700 mb-2">Included:</div>
              {Object.entries(plan.quotas).map(([metric, amount]) => (
                <div key={metric} className="flex items-center text-sm">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  <span>
                    {formatUsageAmount(metric as any, amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Overage Rates */}
            {plan.overageRates && Object.values(plan.overageRates).some(r => r > 0) && (
              <div className="space-y-2 mb-6 border-t pt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Overage:</div>
                {Object.entries(plan.overageRates).map(([metric, rate]) => {
                  if (rate === 0) return null;
                  return (
                    <div key={metric} className="text-xs text-gray-600">
                      {formatMetricName(metric as any)}: ${rate.toFixed(4)}/unit
                    </div>
                  );
                })}
              </div>
            )}

            {/* Features */}
            <div className="space-y-2 mb-6 border-t pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Features:</div>
              {plan.features.slice(0, 5).map((feature, idx) => (
                <div key={idx} className="flex items-start text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSelect(tier as PlanTier)}
              disabled={loading || isCurrentPlan}
              className={`
                w-full py-3 px-4 rounded-lg font-semibold transition-colors
                ${isCurrentPlan
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
                ${loading ? 'opacity-50 cursor-wait' : ''}
              `}
            >
              {loading && isSelected
                ? 'Processing...'
                : isCurrentPlan
                ? 'Current Plan'
                : tier === 'free'
                ? 'Downgrade to Free'
                : currentPlan === 'free'
                ? `Upgrade to ${plan.name}`
                : `Switch to ${plan.name}`
              }
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default PlanSelector;
