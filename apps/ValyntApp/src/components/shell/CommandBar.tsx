/**
 * Shell Layer: CommandBar
 * ⌘K modal for AI agent invocation
 */

import React, { useEffect, useRef, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setSelectedIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        onSubmit(suggestions[selectedIndex]);
        onClose();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onSubmit, suggestions, selectedIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onSubmit(value);
      if (inputRef.current) inputRef.current.value = "";
      setSelectedIndex(-1);
      onClose();
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
              onClick={() => {
                onSubmit(suggestion);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted",
                selectedIndex === i && "bg-muted"
              )}
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
