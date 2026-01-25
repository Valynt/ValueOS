/**
 * Shell Layer: CommandBar
 * ⌘K modal for AI agent invocation
 */

import React, { useEffect, useRef } from "react";
import { Search, Sparkles, X } from "lucide-react";

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (query: string) => void;
  suggestions?: string[];
}

const defaultSuggestions = [
  "Analyze value drivers for this account",
  "Generate ROI calculation",
  "Create executive summary",
  "Compare with similar cases",
];

export function CommandBar({
  open,
  onClose,
  onSubmit,
  suggestions = defaultSuggestions,
}: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onSubmit(value);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl animate-fade-in-down rounded-xl border border-border bg-card shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask the Value Intelligence Agent..."
              className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </form>
        <div className="p-2">
          <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Suggestions
          </div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSubmit(suggestion)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommandBar;
