import { X } from "lucide-react";
import React, { useEffect, useRef, useCallback } from "react";

import { cn } from "@/lib/utils";

interface ReasoningViewerProps {
  reasoning: string;
  onClose: () => void;
  title?: string;
}

const backdropClasses = "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm transition-opacity";
const cardClasses = "bg-[var(--vds-color-surface)] rounded-lg shadow-xl p-6 max-w-lg w-full relative border border-[var(--vds-color-border)]";
const titleClasses = "text-lg font-semibold text-[var(--vds-color-text-primary)] mb-2";
const contentClasses = "text-sm text-[var(--vds-color-text-secondary)] whitespace-pre-line max-h-[60vh] overflow-auto";
const closeButtonClasses = "absolute top-3 right-3 p-1.5 rounded-lg text-[var(--vds-color-text-muted)] hover:text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30";

export const ReasoningViewer: React.FC<ReasoningViewerProps> = ({
  reasoning,
  onClose,
  title = "Reasoning Provenance"
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [handleEscape]);

  return (
    <div
      className={backdropClasses}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reasoning-title"
    >
      <div className={cardClasses}>
        <button
          ref={closeRef}
          className={closeButtonClasses}
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2 id="reasoning-title" className={titleClasses}>{title}</h2>
        <div className={contentClasses} role="document">
          {reasoning}
        </div>
      </div>
    </div>
  );
};

ReasoningViewer.displayName = "ReasoningViewer";
