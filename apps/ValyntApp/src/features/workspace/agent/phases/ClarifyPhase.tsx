/**
 * ClarifyPhase — Amber-accented question cards for resolving ambiguity.
 * Supports both option selection and freeform text input.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClarifyOption } from "../types";

interface ClarifyPhaseProps {
  question: string;
  options?: ClarifyOption[];
  defaultOption?: string;
  allowFreeform: boolean;
  onSelectOption: (optionId: string) => void;
  onSubmitFreeform: (text: string) => void;
  className?: string;
}

export function ClarifyPhase({
  question,
  options = [],
  defaultOption,
  allowFreeform,
  onSelectOption,
  onSubmitFreeform,
  className,
}: ClarifyPhaseProps) {
  const [freeformValue, setFreeformValue] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(defaultOption ?? null);

  const handleOptionClick = (id: string) => {
    setSelectedId(id);
    onSelectOption(id);
  };

  const handleFreeformSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = freeformValue.trim();
    if (!trimmed) return;
    onSubmitFreeform(trimmed);
    setFreeformValue("");
  };

  return (
    <div className={cn("animate-fade-in", className)}>
      <Card className="p-5 border-warning/30 bg-warning/5 shadow-sm">
        {/* Amber glow indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse-subtle" />
          <span className="text-xs font-semibold text-warning-700 uppercase tracking-wide">
            Clarification Needed
          </span>
        </div>

        {/* Question */}
        <p className="text-sm text-slate-800 font-medium mb-4 leading-relaxed">
          {question}
        </p>

        {/* Option cards */}
        {options.length > 0 && (
          <div className="grid gap-2 mb-4">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all",
                  selectedId === option.id
                    ? "border-warning bg-warning/10 text-warning-700 ring-1 ring-warning/40"
                    : "border-slate-200 bg-white hover:border-warning/40 hover:bg-warning/5 text-slate-700"
                )}
              >
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Freeform input */}
        {allowFreeform && (
          <form onSubmit={handleFreeformSubmit} className="flex gap-2">
            <input
              type="text"
              value={freeformValue}
              onChange={(e) => setFreeformValue(e.target.value)}
              placeholder="Or type your own answer..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-warning/40 focus:border-warning"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!freeformValue.trim()}
              className="bg-warning hover:bg-warning/90 text-white"
            >
              Send
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
