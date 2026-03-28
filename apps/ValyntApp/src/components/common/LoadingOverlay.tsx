/**
 * LoadingOverlay
 *
 * Full-area or inline loading indicator with contextual status messages.
 * Prevents the "silent interface" anti-pattern.
 *
 * UX Principles:
 * - Immediate Feedback: spinner + message tells user the system is working
 * - System Status: contextual message explains what's happening
 * - Accessibility: role="status", aria-live for screen readers
 */

import { Loader2 } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export interface LoadingOverlayProps {
  /** What the system is doing (e.g., "Analyzing financial models...") */
  message?: string;
  /** Secondary detail (e.g., "Step 2 of 7") */
  detail?: string;
  /** Whether to cover the full parent area with a backdrop */
  overlay?: boolean;
  /** Size of the spinner */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: { spinner: "h-4 w-4", text: "text-xs", gap: "gap-2" },
  md: { spinner: "h-6 w-6", text: "text-sm", gap: "gap-3" },
  lg: { spinner: "h-8 w-8", text: "text-base", gap: "gap-4" },
};

export function LoadingOverlay({
  message = "Loading...",
  detail,
  overlay = false,
  size = "md",
  className,
}: LoadingOverlayProps) {
  const sizes = sizeConfig[size];

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        sizes.gap,
        !overlay && "py-12",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className={cn("animate-spin text-primary", sizes.spinner)} />
      <div className="text-center">
        <p className={cn("font-medium text-foreground", sizes.text)}>{message}</p>
        {detail && (
          <p className={cn("text-muted-foreground mt-0.5", size === "sm" ? "text-[10px]" : "text-xs")}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        {content}
      </div>
    );
  }

  return content;
}

export { LoadingOverlay };
