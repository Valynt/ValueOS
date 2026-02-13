/**
 * KPICards
 * 
 * Financial KPI summary cards showing NPV, Payback Period, Cost of Inaction.
 * Inspired by ValueCanvas dashboard mockups.
 */

import React from 'react';
import { TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KPIData {
  npv?: number;
  roi?: number;
  paybackMonths?: number;
  costOfInaction?: number;
  totalValue?: number;
  industryComparison?: {
    npv?: string;
    payback?: string;
    costOfInaction?: string;
  };
}

interface KPICardsProps {
  data: KPIData;
  className?: string;
  variant?: 'light' | 'dark';
}

export function KPICards({ data, className, variant = 'light' }: KPICardsProps) {
  const isDark = variant === 'dark';

  return (
    <div className={cn(
      "grid grid-cols-3 gap-4",
      className
    )}>
      {/* Net Present Value */}
      <KPICard
        label="NET PRESENT VALUE"
        value={formatCurrency(data.npv)}
        comparison={data.industryComparison?.npv}
        icon={TrendingUp}
        iconColor="text-emerald-500"
        variant={variant}
      />

      {/* Payback Period */}
      <KPICard
        label="PAYBACK PERIOD"
        value={formatPayback(data.paybackMonths)}
        comparison={data.industryComparison?.payback}
        icon={Clock}
        iconColor="text-blue-500"
        variant={variant}
      />

      {/* Cost of Inaction */}
      <KPICard
        label="COST OF INACTION"
        value={formatCostPerMonth(data.costOfInaction)}
        comparison={data.industryComparison?.costOfInaction}
        icon={AlertTriangle}
        iconColor="text-red-500"
        variant={variant}
        valueColor="text-red-500"
      />
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  comparison?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  valueColor?: string;
  variant: 'light' | 'dark';
}

function KPICard({
  label,
  value,
  comparison,
  icon: Icon,
  iconColor,
  valueColor,
  variant,
}: KPICardProps) {
  const isDark = variant === 'dark';

  return (
    <div className={cn(
      "rounded-xl p-5 transition-all",
      isDark 
        ? "bg-slate-800/50 border border-slate-700/50" 
        : "bg-white border border-slate-200 shadow-sm"
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className={cn(
          "text-xs font-semibold tracking-wider",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          {label}
        </span>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      
      <div className={cn(
        "text-2xl font-bold mb-1",
        valueColor || (isDark ? "text-white" : "text-slate-900")
      )}>
        {value}
      </div>
      
      {comparison && (
        <div className={cn(
          "text-xs",
          isDark ? "text-slate-500" : "text-slate-400"
        )}>
          {comparison}
        </div>
      )}
    </div>
  );
}

// Formatting helpers
function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return '—';
  
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPayback(months?: number): string {
  if (months === undefined || months === null) return '—';
  return `${months.toFixed(1)} Mo`;
}

function formatCostPerMonth(value?: number): string {
  if (value === undefined || value === null) return '—';
  
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M/mo`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k/mo`;
  }
  return `$${value.toFixed(0)}/mo`;
}

/**
 * Compact horizontal KPI strip for headers
 */
export function KPIStrip({ data, className }: { data: KPIData; className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-6 text-sm",
      className
    )}>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">NPV</span>
        <span className="font-semibold text-emerald-600">{formatCurrency(data.npv)}</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-2">
        <span className="text-slate-500">ROI</span>
        <span className="font-semibold text-slate-900">{data.roi ? `${data.roi}%` : '—'}</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-2">
        <span className="text-slate-500">Payback</span>
        <span className="font-semibold text-slate-900">{formatPayback(data.paybackMonths)}</span>
      </div>
    </div>
  );
}

export default KPICards;
