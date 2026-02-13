/**
 * GuestValueCalculator
 * 
 * Interactive value calculator for guest users.
 * Allows adjusting assumptions and seeing real-time ROI impact.
 */

import { useState, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent,
  RefreshCw,
  Download,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KPICards, type KPIData } from '@/features/workspace/components/KPICards';
import { exportToPdf } from '@/features/workspace/services/exportPdf';

// Value driver definition
interface ValueDriver {
  id: string;
  name: string;
  description: string;
  baseImpact: number; // Annual impact in dollars
  confidence: number;
  adjustable: boolean;
}

// Assumption definition
interface Assumption {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  impactMultiplier: number; // How much each unit change affects total value
}

interface GuestValueCalculatorProps {
  companyName: string;
  title: string;
  valueDrivers: ValueDriver[];
  assumptions: Assumption[];
  baseMetrics: {
    npv: number;
    roi: number;
    paybackMonths: number;
    timeHorizon: string;
  };
  guestName?: string;
  expiresAt?: string;
  canEdit?: boolean;
}

export function GuestValueCalculator({
  companyName,
  title,
  valueDrivers: initialDrivers,
  assumptions: initialAssumptions,
  baseMetrics,
  guestName = 'Guest',
  expiresAt,
  canEdit = true,
}: GuestValueCalculatorProps) {
  // State for adjustable assumptions
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [showDetails, setShowDetails] = useState(false);

  // Calculate adjusted values based on assumptions
  const calculatedValues = useMemo(() => {
    // Calculate adjustment factor from assumption changes
    let adjustmentFactor = 1;
    
    assumptions.forEach((assumption, index) => {
      const original = initialAssumptions[index];
      if (original) {
        const change = (assumption.value - original.value) / original.value;
        adjustmentFactor += change * assumption.impactMultiplier;
      }
    });

    // Adjust value drivers
    const adjustedDrivers = initialDrivers.map(driver => ({
      ...driver,
      adjustedImpact: driver.baseImpact * adjustmentFactor,
    }));

    // Calculate totals
    const totalAnnualValue = adjustedDrivers.reduce((sum, d) => sum + d.adjustedImpact, 0);
    const totalValue = totalAnnualValue * 3; // 3-year value
    
    // Adjust metrics
    const adjustedNpv = baseMetrics.npv * adjustmentFactor;
    const adjustedRoi = baseMetrics.roi * adjustmentFactor;
    const adjustedPayback = baseMetrics.paybackMonths / adjustmentFactor;

    return {
      drivers: adjustedDrivers,
      totalAnnualValue,
      totalValue,
      npv: adjustedNpv,
      roi: adjustedRoi,
      paybackMonths: Math.max(1, adjustedPayback),
      costOfInaction: totalAnnualValue / 12, // Monthly cost of not acting
    };
  }, [assumptions, initialAssumptions, initialDrivers, baseMetrics]);

  // Handle assumption change
  const handleAssumptionChange = useCallback((id: string, value: number) => {
    if (!canEdit) return;
    
    setAssumptions(prev => 
      prev.map(a => a.id === id ? { ...a, value } : a)
    );
  }, [canEdit]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setAssumptions(initialAssumptions);
  }, [initialAssumptions]);

  // Export PDF
  const handleExport = useCallback(() => {
    exportToPdf({
      title: `${title} - Custom Scenario`,
      companyName,
      artifacts: [
        {
          id: 'value-model',
          type: 'value_model',
          title: 'Value Model',
          status: 'approved',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          content: {
            kind: 'json',
            data: {
              valueDrivers: calculatedValues.drivers.map(d => ({
                name: d.name,
                impact: d.adjustedImpact,
                confidence: d.confidence,
              })),
              totalValue: calculatedValues.totalValue,
              timeHorizon: baseMetrics.timeHorizon,
            },
          },
        },
      ],
      kpiData: {
        npv: calculatedValues.npv,
        roi: calculatedValues.roi,
        paybackMonths: calculatedValues.paybackMonths,
        costOfInaction: calculatedValues.costOfInaction,
      },
    });
  }, [title, companyName, calculatedValues, baseMetrics.timeHorizon]);

  // KPI data for cards
  const kpiData: KPIData = {
    npv: calculatedValues.npv,
    roi: calculatedValues.roi,
    paybackMonths: calculatedValues.paybackMonths,
    costOfInaction: calculatedValues.costOfInaction,
    industryComparison: {
      npv: '+12% vs industry avg',
      payback: '-1.5 Mo vs industry avg',
      costOfInaction: 'High Risk',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                Value Calculator
              </div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">Prepared for {companyName}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
                Reset
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* KPI Summary */}
        <section className="mb-8">
          <KPICards data={kpiData} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assumptions Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Percent size={20} className="text-primary" />
                Adjust Assumptions
              </h2>
              
              {!canEdit && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  View-only mode. Contact the owner to request edit access.
                </div>
              )}

              <div className="space-y-6">
                {assumptions.map((assumption) => (
                  <AssumptionSlider
                    key={assumption.id}
                    assumption={assumption}
                    onChange={(value) => handleAssumptionChange(assumption.id, value)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Value Drivers */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-500" />
                  Value Drivers
                </h2>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <Info size={14} />
                  {showDetails ? 'Hide' : 'Show'} details
                </button>
              </div>

              <div className="space-y-4">
                {calculatedValues.drivers.map((driver) => (
                  <ValueDriverCard
                    key={driver.id}
                    driver={driver}
                    showDetails={showDetails}
                  />
                ))}
              </div>

              {/* Total */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-500">
                      Total Value ({baseMetrics.timeHorizon})
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Based on your adjusted assumptions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-600">
                      {formatCurrency(calculatedValues.totalValue)}
                    </div>
                    <div className="text-sm text-slate-500">
                      {formatCurrency(calculatedValues.totalAnnualValue)}/year
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Chart Placeholder */}
            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-blue-500" />
                Projected Returns
              </h2>
              
              <div className="h-64 flex items-end justify-around gap-4 px-4">
                {[1, 2, 3].map((year) => {
                  const yearValue = calculatedValues.totalAnnualValue * year;
                  const maxValue = calculatedValues.totalValue;
                  const height = (yearValue / maxValue) * 200;
                  
                  return (
                    <div key={year} className="flex flex-col items-center gap-2">
                      <div className="text-sm font-medium text-slate-600">
                        {formatCurrency(yearValue)}
                      </div>
                      <div
                        className="w-20 bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all duration-500"
                        style={{ height: `${height}px` }}
                      />
                      <div className="text-sm text-slate-500">Year {year}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Powered by ValueOS</span>
            {expiresAt && (
              <span>Access expires: {new Date(expiresAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

// Assumption Slider Component
interface AssumptionSliderProps {
  assumption: Assumption;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function AssumptionSlider({ assumption, onChange, disabled }: AssumptionSliderProps) {
  const percentage = ((assumption.value - assumption.min) / (assumption.max - assumption.min)) * 100;

  return (
    <div className={cn("space-y-2", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {assumption.label}
        </label>
        <span className="text-sm font-semibold text-slate-900">
          {assumption.value.toLocaleString()}{assumption.unit}
        </span>
      </div>
      
      <input
        type="range"
        min={assumption.min}
        max={assumption.max}
        step={assumption.step}
        value={assumption.value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, rgb(var(--primary)) ${percentage}%, rgb(226 232 240) ${percentage}%)`,
        }}
      />
      
      <div className="flex justify-between text-xs text-slate-400">
        <span>{assumption.min.toLocaleString()}{assumption.unit}</span>
        <span>{assumption.max.toLocaleString()}{assumption.unit}</span>
      </div>
      
      {assumption.description && (
        <p className="text-xs text-slate-500">{assumption.description}</p>
      )}
    </div>
  );
}

// Value Driver Card Component
interface ValueDriverCardProps {
  driver: ValueDriver & { adjustedImpact: number };
  showDetails: boolean;
}

function ValueDriverCard({ driver, showDetails }: ValueDriverCardProps) {
  const changePercent = ((driver.adjustedImpact - driver.baseImpact) / driver.baseImpact) * 100;
  const isPositive = changePercent >= 0;

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-slate-800">{driver.name}</h3>
          {showDetails && (
            <p className="text-sm text-slate-500 mt-1">{driver.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-600">
            {formatCurrency(driver.adjustedImpact)}
          </div>
          {changePercent !== 0 && (
            <div className={cn(
              "text-xs font-medium",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}>
              {isPositive ? '+' : ''}{changePercent.toFixed(1)}% from base
            </div>
          )}
        </div>
      </div>
      
      {showDetails && (
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span>Base: {formatCurrency(driver.baseImpact)}</span>
          <span>Confidence: {Math.round(driver.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}

// Helpers
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export default GuestValueCalculator;
