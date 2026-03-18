/**
 * GapResolution Widget
 *
 * List of missing data items with inline input fields, submit action, and resolved state.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.1
 */

import React, { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, Send } from "lucide-react";
import { WidgetProps } from "../CanvasHost";

export interface GapItem {
  id: string;
  field: string;
  description: string;
  required: boolean;
  resolved: boolean;
  value?: string | number | boolean;
}

export interface GapResolutionData {
  gaps: GapItem[];
  caseId: string;
}

export function GapResolution({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as GapResolutionData;
  const gaps = widgetData.gaps ?? [];
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const handleInputChange = (gapId: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [gapId]: value }));
  };

  const handleSubmit = async (gapId: string) => {
    const value = inputValues[gapId];
    if (!value?.trim()) return;

    setSubmitting((prev) => ({ ...prev, [gapId]: true }));

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    onAction?.("submitGap", { gapId, value });

    setSubmitting((prev) => ({ ...prev, [gapId]: false }));
    setInputValues((prev) => ({ ...prev, [gapId]: "" }));
  };

  const resolvedCount = gaps.filter((g) => g.resolved).length;
  const progress = gaps.length > 0 ? (resolvedCount / gaps.length) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Gap Resolution</h3>
            <p className="text-sm text-muted-foreground">
              {resolvedCount} of {gaps.length} resolved
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-6">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {gaps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p>All gaps resolved!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div
              key={gap.id}
              className={`p-4 rounded-lg border ${
                gap.resolved ? "bg-green-50 border-green-200" : "bg-card border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {gap.resolved ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{gap.field}</span>
                    {gap.required && (
                      <span className="text-xs text-red-500 font-medium">*Required</span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">{gap.description}</p>

                  {gap.resolved ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-medium text-green-700">{String(gap.value)}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputValues[gap.id] ?? ""}
                        onChange={(e) => handleInputChange(gap.id, e.target.value)}
                        placeholder="Enter value..."
                        className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSubmit(gap.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSubmit(gap.id)}
                        disabled={!inputValues[gap.id]?.trim() || submitting[gap.id]}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting[gap.id] ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GapResolution;
