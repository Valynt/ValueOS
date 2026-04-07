/**
 * CopilotPresence — Attention state indicators for the copilot
 *
 * Shows visual feedback about what the copilot is doing:
 * - observing: subtle presence
 * - suggesting: ready to help
 * - working: actively processing
 *
 * Phase 4: Hardening - 4.1.3 Copilot presence indicators
 */

import { useState, useEffect } from 'react';

type AttentionState = 'observing' | 'suggesting' | 'working';

interface CopilotPresenceProps {
  state: AttentionState;
  /** Optional message to display */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show text label */
  showLabel?: boolean;
}

export function CopilotPresence({
  state,
  message,
  size = 'md',
  showLabel = true,
}: CopilotPresenceProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const labelText = message || {
    observing: 'Observing',
    suggesting: 'Has a suggestion',
    working: 'Working...',
  }[state];

  return (
    <div className="flex items-center gap-2" data-testid="copilot-presence">
      <div className="relative">
        {/* Base dot */}
        <div
          className={`${sizeClasses[size]} rounded-full ${
            state === 'working' ? 'bg-blue-500' : 'bg-slate-400'
          }`}
        />

        {/* Suggesting pulse ring */}
        {state === 'suggesting' && (
          <div className="absolute inset-0 animate-ping rounded-full bg-slate-400 opacity-75" />
        )}

        {/* Working typing animation */}
        {state === 'working' && (
          <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
            <span className="h-0.5 w-0.5 animate-bounce rounded-full bg-blue-600 [animation-delay:0ms]" />
            <span className="h-0.5 w-0.5 animate-bounce rounded-full bg-blue-600 [animation-delay:150ms]" />
            <span className="h-0.5 w-0.5 animate-bounce rounded-full bg-blue-600 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {showLabel && (
        <span className="text-sm text-slate-600" data-testid="copilot-presence-label">
          {labelText}
        </span>
      )}
    </div>
  );
}

// Typing indicator for copilot messages
interface TypingIndicatorProps {
  /** Number of dots */
  count?: number;
}

export function TypingIndicator({ count = 3 }: TypingIndicatorProps): JSX.Element {
  return (
    <div className="flex items-center gap-1" data-testid="typing-indicator">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// Message with inline action buttons
interface CopilotMessageProps {
  /** Message text */
  content: string;
  /** Optional action buttons */
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  /** Is the copilot still typing */  
  isTyping?: boolean;
}

export function CopilotMessage({
  content,
  actions,
  isTyping = false,
}: CopilotMessageProps): JSX.Element {
  return (
    <div className="space-y-3" data-testid="copilot-message">
      <div className="text-sm text-slate-700">{content}</div>

      {isTyping && <TypingIndicator />}

      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                action.variant === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook for managing copilot attention state
interface UseCopilotAttentionOptions {
  /** Auto-transition to observing after N ms of inactivity */
  idleTimeout?: number;
}

export function useCopilotAttention(
  options: UseCopilotAttentionOptions = {}
): {
  state: AttentionState;
  setState: (state: AttentionState) => void;
  startWorking: () => void;
  finishWorking: () => void;
  suggest: (message?: string) => void;
} {
  const { idleTimeout = 5000 } = options;
  const [state, setState] = useState<AttentionState>('observing');
  const [suggestionMessage, setSuggestionMessage] = useState<string>();
  const idleTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef[0]) {
      clearTimeout(idleTimerRef[0]);
    }
    const timer = setTimeout(() => {
      setState('observing');
    }, idleTimeout);
    idleTimerRef[0] = timer;
  };

  const startWorking = () => {
    setState('working');
    resetIdleTimer();
  };

  const finishWorking = () => {
    setState('observing');
    resetIdleTimer();
  };

  const suggest = (message?: string) => {
    setSuggestionMessage(message);
    setState('suggesting');
    resetIdleTimer();
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef[0]) {
        clearTimeout(idleTimerRef[0]);
      }
    };
  }, []);

  return {
    state,
    setState,
    startWorking,
    finishWorking,
    suggest,
  };
}
