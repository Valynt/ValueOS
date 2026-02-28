/**
 * FE-022: Clarify State UI
 *
 * Displays the agent's clarification question with selectable options
 * and optional freeform input. Supports keyboard navigation.
 */

import { HelpCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ClarifyOption } from "../../agent/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";


interface ClarifyPanelProps {
  question: string;
  options: ClarifyOption[];
  defaultOption?: string;
  allowFreeform: boolean;
  onSelectOption: (optionId: string) => void;
  onSubmitFreeform: (text: string) => void;
  onCancel: () => void;
}

export function ClarifyPanel({
  question,
  options,
  defaultOption,
  allowFreeform,
  onSelectOption,
  onSubmitFreeform,
  onCancel,
}: ClarifyPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultOption ?? null);
  const [freeformText, setFreeformText] = useState("");
  const [showFreeform, setShowFreeform] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showFreeform) inputRef.current?.focus();
  }, [showFreeform]);

  const handleSubmit = () => {
    if (showFreeform && freeformText.trim()) {
      onSubmitFreeform(freeformText.trim());
    } else if (selectedId) {
      onSelectOption(selectedId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (selectedId || freeformText.trim())) {
      handleSubmit();
    }
  };

  return (
    <Card className="border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Clarification Needed
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-600 rounded"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Question */}
      <div className="p-4">
        <p className="text-sm text-slate-700 leading-relaxed">{question}</p>
      </div>

      {/* Options */}
      {options.length > 0 && (
        <div className="px-4 pb-3 space-y-2" onKeyDown={handleKeyDown}>
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setSelectedId(option.id);
                setShowFreeform(false);
                onSelectOption(option.id);
              }}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
                "hover:border-blue-300 hover:bg-blue-50/50",
                selectedId === option.id
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors",
                    selectedId === option.id
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300"
                  )}
                >
                  {selectedId === option.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{option.label}</p>
                  {option.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Freeform input */}
      {allowFreeform && (
        <div className="px-4 pb-3">
          {!showFreeform ? (
            <button
              onClick={() => {
                setShowFreeform(true);
                setSelectedId(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Or type your own answer...
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={freeformText}
                onChange={(e) => setFreeformText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && freeformText.trim()) {
                    onSubmitFreeform(freeformText.trim());
                  }
                }}
                placeholder="Type your answer..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              />
              <Button
                size="sm"
                disabled={!freeformText.trim()}
                onClick={() => onSubmitFreeform(freeformText.trim())}
              >
                <Send size={14} />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
