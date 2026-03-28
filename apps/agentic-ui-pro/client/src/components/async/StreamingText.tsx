/**
 * StreamingText
 *
 * Renders text that streams in token-by-token, creating the feeling of
 * a live agent writing. Shows a skeleton placeholder while waiting.
 */

import { cn } from '@/lib/utils';

interface StreamingTextProps {
  text: string;
  isComplete: boolean;
  isWaiting?: boolean;
  placeholder?: string;
  className?: string;
  skeletonLines?: number;
}

export function StreamingText({
  text,
  isComplete,
  isWaiting = false,
  placeholder = 'Generating...',
  className,
  skeletonLines = 3,
}: StreamingTextProps) {
  if (isWaiting && !text) {
    return (
      <div className={cn('space-y-2 animate-pulse', className)}>
        {Array.from({ length: skeletonLines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-white/8"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1 h-3 rounded-sm bg-violet-500/60 animate-pulse" />
          <span className="text-xs text-white/30">{placeholder}</span>
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className={cn('relative', className)}>
      <span className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
        {text}
      </span>
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

/**
 * SkeletonCard — used while an agent is working on a section
 */
export function SkeletonCard({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('p-4 rounded-xl border border-white/6 bg-white/2 animate-pulse', className)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/8" />
        <div className="h-3 w-4/5 rounded bg-white/8" />
        <div className="h-3 w-3/5 rounded bg-white/8" />
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className="w-1 h-3 rounded-sm bg-violet-500/50 animate-pulse" />
        <span className="text-xs text-white/25">{label}</span>
      </div>
    </div>
  );
}
