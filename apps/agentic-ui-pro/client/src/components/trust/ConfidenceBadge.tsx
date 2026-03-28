/**
 * ConfidenceBadge
 *
 * Displays a confidence score as a visual badge with color-coded severity.
 * Used inline on value nodes, hypotheses, and evidence items.
 */

import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getConfidenceLevel(score: number): {
  label: string;
  color: string;
  bg: string;
  ring: string;
} {
  if (score >= 0.85) return { label: 'High', color: 'text-emerald-300', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/30' };
  if (score >= 0.7) return { label: 'Moderate', color: 'text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-500/30' };
  if (score >= 0.5) return { label: 'Low', color: 'text-orange-300', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' };
  return { label: 'Weak', color: 'text-rose-300', bg: 'bg-rose-500/15', ring: 'ring-rose-500/30' };
}

export function ConfidenceBadge({ score, size = 'md', showLabel = true, className }: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(score);
  const pct = Math.round(score * 100);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-mono font-medium ring-1',
        level.bg,
        level.color,
        level.ring,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn('rounded-full', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', level.color.replace('text-', 'bg-'))} />
      <span>{pct}%</span>
      {showLabel && <span className="opacity-70">{level.label}</span>}
    </span>
  );
}
