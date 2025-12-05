import React from 'react';
import { BarChart2, TrendingUp } from 'lucide-react';

export interface ExpansionBlockProps {
  gaps: string[];
  roi: {
    revenue: number;
    cost: number;
  };
  label?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const ExpansionBlock: React.FC<ExpansionBlockProps> = ({ gaps, roi, label = 'Expansion Model' }) => {
  const contribution = roi.revenue - roi.cost;
  const contributionLabel = contribution >= 0 ? 'Net Benefit' : 'Net Cost';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="expansion-block">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-50 p-2 text-purple-600" aria-hidden="true">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        </div>
        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">SDUI</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-gray-500 mb-2">Identified Gaps</p>
          <div className="space-y-2">
            {gaps.map((gap) => (
              <div key={gap} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-800">
                <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden="true" />
                <span className="flex-1">{gap}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <p className="text-xs font-medium text-gray-600">ROI Snapshot</p>
          </div>
          <dl className="space-y-1 text-sm text-gray-900">
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Revenue</dt>
              <dd className="font-semibold">{formatCurrency(roi.revenue)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Cost</dt>
              <dd className="font-semibold">{formatCurrency(roi.cost)}</dd>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <dt className="text-gray-600">{contributionLabel}</dt>
              <dd className={`font-semibold ${contribution >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(contribution)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
