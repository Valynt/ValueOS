/**
 * ComponentName
 *
 * [One-line description of what this component displays and in which agent stage.]
 *
 * Replace all <ComponentName> / <componentName> placeholders before use.
 * Delete comments that restate the code once you've filled in the implementation.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComponentNameProps {
  // Required props — list every field the agent output will always provide
  requiredProp: string;

  // Optional props — use "?" for anything that may be absent
  title?: string;
  variant?: "default" | "compact";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComponentName({ requiredProp, title, variant = "default" }: ComponentNameProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {title && (
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      )}

      <div className={variant === "compact" ? "text-sm" : "text-base"}>
        {/* Render requiredProp and other data here */}
        {requiredProp}
      </div>
    </div>
  );
}
