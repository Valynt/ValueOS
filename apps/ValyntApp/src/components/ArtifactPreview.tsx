// apps/ValyntApp/src/components/ArtifactPreview.tsx
import { Download, X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface ArtifactPreviewProps {
  content: string;
  title: string;
  onClose: () => void;
  fileType?: "txt" | "json" | "md";
}

const backdropClasses = "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm transition-opacity";
const cardClasses = "bg-[var(--vds-color-surface)] p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-[var(--vds-color-border)]";
const headerClasses = "flex justify-between items-center mb-4 pb-4 border-b border-[var(--vds-color-border)]";
const titleClasses = "text-xl font-semibold text-[var(--vds-color-text-primary)]";
const actionsClasses = "flex gap-2";
const downloadButtonClasses = "inline-flex items-center gap-2 px-4 py-2 bg-[var(--vds-color-primary)] text-white rounded-lg hover:brightness-110 transition-all text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30";
const closeButtonClasses = "px-4 py-2 bg-[var(--vds-color-surface-2)] text-[var(--vds-color-text-primary)] rounded-lg hover:bg-[var(--vds-color-surface-2)]/80 transition-colors text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30";
const contentClasses = "flex-1 overflow-auto bg-[var(--vds-color-surface-2)] rounded-lg p-4";
const preClasses = "whitespace-pre-wrap text-sm text-[var(--vds-color-text-primary)] font-mono";

const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({ content, title, onClose, fileType = "txt" }) => {
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

  const handleDownload = useCallback(() => {
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      json: "application/json",
      md: "text/markdown",
    };

    const blob = new Blob([content], { type: mimeTypes[fileType] || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.${fileType}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, title, fileType]);

  return (
    <div
      className={backdropClasses}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="artifact-title"
    >
      <div className={cardClasses}>
        <div className={headerClasses}>
          <h2 id="artifact-title" className={titleClasses}>{title}</h2>
          <div className={actionsClasses}>
            <button
              onClick={handleDownload}
              className={downloadButtonClasses}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Download
            </button>
            <button
              ref={closeRef}
              onClick={onClose}
              className={closeButtonClasses}
              aria-label="Close"
            >
              <X className="w-4 h-4 mr-1" aria-hidden="true" />
              Close
            </button>
          </div>
        </div>
        <div className={contentClasses}>
          <pre className={preClasses}>{content}</pre>
        </div>
      </div>
    </div>
  );
};

ArtifactPreview.displayName = "ArtifactPreview";

export default ArtifactPreview;
