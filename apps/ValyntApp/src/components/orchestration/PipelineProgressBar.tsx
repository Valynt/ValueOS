/**
 * PipelineProgressBar
 *
 * Compact animated progress bar showing overall pipeline completion.
 * Includes a pulsing glow on the leading edge during active processing.
 */

interface PipelineProgressBarProps {
  /** 0–1 fraction of pipeline completion. */
  progress: number;
  /** Whether the pipeline is actively running. */
  isRunning: boolean;
  /** Optional label shown to the right. */
  label?: string;
  className?: string;
}

export function PipelineProgressBar({
  progress,
  isRunning,
  label,
  className = "",
}: PipelineProgressBarProps) {
  const pct = Math.round(progress * 100);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        {/* Filled track */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-indigo to-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />

        {/* Pulsing leading edge */}
        {isRunning && pct > 0 && pct < 100 && (
          <div
            className="absolute inset-y-0 w-8 rounded-full bg-card/40 animate-pulse"
            style={{ left: `calc(${pct}% - 16px)` }}
          />
        )}
      </div>

      {/* Label */}
      {label ? (
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
          {label}
        </span>
      ) : (
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
          {pct}%
        </span>
      )}
    </div>
  );
}
