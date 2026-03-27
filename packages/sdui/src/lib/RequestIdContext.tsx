import React, { createContext, useContext, useEffect, useRef } from "react";

/**
 * Provides the last failed API request ID to SDUI error boundaries.
 * Populated by the app layer (ApiRequestProvider) so boundaries can
 * surface a copyable ID for support correlation.
 */
export interface RequestIdContextValue {
  lastFailedRequestId: string | null;
}

export const RequestIdContext = createContext<RequestIdContextValue>({
  lastFailedRequestId: null,
});

export function useRequestId(): RequestIdContextValue {
  return useContext(RequestIdContext);
}

/**
 * Copyable request ID row for use inside error boundary fallback UI.
 * Only renders when a requestId is available.
 */
export function RequestIdRow({ requestId }: { requestId: string | null }) {
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending reset timer on unmount to avoid state updates on an
  // unmounted component (e.g. when the error boundary recovers within 2s).
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  if (!requestId) return null;

  const scheduleReset = () => {
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setCopyState("idle");
    }, 2000);
  };

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      // Clipboard API unavailable — fall back to a prompt so the user can copy manually.
      window.prompt("Copy this request ID:", requestId);
      return;
    }
    navigator.clipboard.writeText(requestId).then(
      () => {
        setCopyState("copied");
        scheduleReset();
      },
      () => {
        // Permission denied or other clipboard error — surface the ID via prompt.
        setCopyState("failed");
        scheduleReset();
        window.prompt("Copy this request ID:", requestId);
      },
    );
  };

  const label = copyState === "copied" ? "Copied!" : copyState === "failed" ? "Copy failed" : "Copy";

  return (
    <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">Request ID:</span>
        <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded select-all">
          {requestId}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
          aria-label="Copy request ID to clipboard"
        >
          {label}
        </button>
      </div>
      <p className="mt-1 text-red-600 opacity-75">
        Include this ID when contacting support.
      </p>
    </div>
  );
}
