/**
 * HeadlineValueCard Component - Displays headline NPV metric
 */

interface HeadlineValueCardProps {
  npv: number;
  annualValue: number;
  scenarioLabel: string;
  lastRecalculated: string;
  currency?: string;
}

export function HeadlineValueCard({
  npv,
  annualValue,
  scenarioLabel,
  lastRecalculated,
  currency = '$',
}: HeadlineValueCardProps) {
  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${currency}${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${currency}${(value / 1000).toFixed(1)}K`;
    }
    return `${currency}${value.toFixed(0)}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-sm">
      <div className="text-xs text-neutral-500 uppercase mb-1">Total NPV</div>
      <div className="text-2xl font-bold text-neutral-900 tabular-nums">
        {formatValue(npv)}
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
        <span className="px-2 py-0.5 bg-neutral-100 rounded">{scenarioLabel}</span>
        <span>•</span>
        <span>Annual: {formatValue(annualValue)}</span>
      </div>
      <div className="text-xs text-neutral-400 mt-1">
        Recalculated {lastRecalculated ? new Date(lastRecalculated).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
}
