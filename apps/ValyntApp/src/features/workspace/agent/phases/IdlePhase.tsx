/**
 * IdlePhase — Breathing pulse orb with input prompt.
 * Shown when the agent is waiting for user input.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface IdlePhaseProps {
  onSubmit: (message: string) => void;
  className?: string;
}

export function IdlePhase({ onSubmit, className }: IdlePhaseProps) {
  const [value, setValue] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-8 p-8", className)}>
      {/* Breathing orb */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full bg-primary/10 animate-breathe" />
        <div className="absolute w-16 h-16 rounded-full bg-primary/20 animate-breathe [animation-delay:150ms]" />
        <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center z-10">
          <div className="w-4 h-4 rounded-full bg-primary" />
        </div>
      </div>

      {/* Prompt */}
      <div className="text-center max-w-md">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          What would you like to build?
        </h3>
        <p className="text-sm text-slate-500">
          Describe a company or scenario and I'll help you build a defensible value case.
        </p>
      </div>

      {/* Quick-start input */}
      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='e.g., "Build an ROI model for reducing cloud costs at Acme Corp"'
            className="w-full pl-5 pr-24 py-3.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Start
          </button>
        </div>
      </form>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-primary/10 hover:text-primary border border-slate-200 hover:border-primary/30 rounded-lg transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "ROI model for cloud migration",
  "Value case for security platform",
  "Cost-benefit analysis for AI adoption",
];
