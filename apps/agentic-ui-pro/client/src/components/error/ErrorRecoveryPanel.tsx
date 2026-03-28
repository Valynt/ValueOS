/**
 * ErrorRecoveryPanel
 *
 * Graceful error handling with specific recovery paths.
 * Offers actionable next steps rather than explanatory text.
 */

import { AlertCircle, RefreshCw, ArrowLeft, SkipForward, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorRecoveryPanelProps {
  title?: string;
  message?: string;
  error: 'network' | 'validation' | 'timeout' | 'unknown' | string;
  onRetry?: () => void;
  onSkip?: () => void;
  onGoBack?: () => void;
  onReset?: () => void;
  className?: string;
}

const ERROR_CONFIG: Record<string, { 
  title: string; 
  message: string; 
  primaryAction: string;
  secondaryAction?: string;
}> = {
  network: {
    title: 'Connection interrupted',
    message: 'We lost connection while processing. Your progress is saved.',
    primaryAction: 'Try again',
    secondaryAction: 'Continue offline',
  },
  validation: {
    title: 'Some inputs need attention',
    message: 'We found issues that should be fixed before continuing.',
    primaryAction: 'Review inputs',
    secondaryAction: 'Skip for now',
  },
  timeout: {
    title: 'Taking longer than expected',
    message: 'This operation is still running. You can wait or try again.',
    primaryAction: 'Try again',
    secondaryAction: 'Cancel',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Your work is preserved.',
    primaryAction: 'Try again',
    secondaryAction: 'Start over',
  },
};

export function ErrorRecoveryPanel({
  title,
  message,
  error,
  onRetry,
  onSkip,
  onGoBack,
  onReset,
  className,
}: ErrorRecoveryPanelProps) {
  const config = ERROR_CONFIG[error] || ERROR_CONFIG.unknown;

  return (
    <div className={cn(
      'p-6 rounded-xl border bg-rose-500/8 border-rose-500/20',
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-rose-300">
            {title || config.title}
          </h3>
          <p className="text-xs text-white/60 mt-1">
            {message || config.message}
          </p>

          {/* Recovery actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-medium hover:bg-rose-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {config.primaryAction}
              </button>
            )}

            {onSkip && (
              <button
                onClick={onSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {config.secondaryAction || 'Skip'}
              </button>
            )}

            {onGoBack && (
              <button
                onClick={onGoBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Go back
              </button>
            )}

            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {config.secondaryAction || 'Reset'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({ message, onRetry, className }: InlineErrorProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 text-xs text-rose-300',
      className
    )}>
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-rose-300 hover:text-rose-200 underline decoration-dotted"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}
