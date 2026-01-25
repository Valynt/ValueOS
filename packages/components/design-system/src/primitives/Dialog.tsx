import React, { useEffect } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "vds-dialog-title" : undefined}
      style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 8000 }}
    >
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,0.6)" }}
        onClick={onClose}
      />
      <div
        style={{
          position: "relative",
          width: "min(720px,95%)",
          background: "var(--vds-color-surface-2)",
          boxShadow: "var(--vds-elev-3)",
          padding: "var(--vds-space-5)",
          borderRadius: 8,
        }}
      >
        {title && (
          <h2 id="vds-dialog-title" style={{ margin: 0, marginBottom: "var(--vds-space-3)" }}>
            {title}
          </h2>
        )}
        {children}
        <div style={{ marginTop: "var(--vds-space-4)", textAlign: "right" }}>
          <button onClick={onClose} aria-label="Close" style={{ padding: "6px 10px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
