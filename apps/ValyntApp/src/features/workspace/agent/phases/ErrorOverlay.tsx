/**
 * ErrorOverlay — Error recovery modal overlaid on any phase.
 * Supports retry (return to previous phase) and reset (return to idle).
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorOverlayProps {
  code: string;
  message: string;
  recoverable: boolean;
  suggestions?: string[];
  onRetry: () => void;
  onReset: () => void;
  className?: string;
}

export function ErrorOverlay({
  code,
  message,
  recoverable,
  suggestions = [],
  onRetry,
  onReset,
  className,
}: ErrorOverlayProps) {
  return (
    <div className={cn("animate-fade-in", className)}>
      <Card className="p-5 border-destructive/30 bg-destructive/5 shadow-md">
        {/* Icon + header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-destructive"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-destructive mb-0.5">
              Something went wrong
            </h4>
            <p className="text-sm text-slate-700">{message}</p>
            <span className="text-2xs text-slate-400 font-mono">{code}</span>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-white/60 rounded-lg p-3 border border-destructive/10 mb-4">
            <div className="text-2xs font-medium text-slate-500 mb-1.5">
              Suggested actions
            </div>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-destructive/60 mt-0.5">&bull;</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex-1 border-slate-300 text-slate-600"
          >
            Start Over
          </Button>
          {recoverable && (
            <Button
              size="sm"
              onClick={onRetry}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
            >
              Retry
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
