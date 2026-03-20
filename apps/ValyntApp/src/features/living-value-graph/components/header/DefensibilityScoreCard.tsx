/**
 * DefensibilityScoreCard Component - Shows % of value backed by evidence
 */

import { formatDefensibilityScore, getDefensibilityColor } from '../../utils/defensibility-calc';

interface DefensibilityScoreCardProps {
  score: number;
  breakdown: {
    backedByEvidence: number;
    totalValue: number;
    coveragePercent: number;
  };
  threshold: number;
  isBlocking: boolean;
}

export function DefensibilityScoreCard({
  score,
  breakdown,
  threshold,
  isBlocking,
}: DefensibilityScoreCardProps) {
  const color = getDefensibilityColor(score);
  const formattedScore = formatDefensibilityScore(score);

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-neutral-200 shadow-sm">
      {/* Circular Progress */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke={color === 'green' ? '#22c55e' : color === 'amber' ? '#f59e0b' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${score * 87.96} 87.96`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{formattedScore}</span>
        </div>
      </div>

      {/* Text Info */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900">Defensibility</span>
        <span className="text-xs text-neutral-500">
          ${(breakdown.backedByEvidence / 1000000).toFixed(1)}M of ${(breakdown.totalValue / 1000000).toFixed(1)}M backed
        </span>
        {isBlocking && (
          <span className="text-xs text-red-600 font-medium">
            Below {Math.round(threshold * 100)}% threshold
          </span>
        )}
      </div>
    </div>
  );
}
