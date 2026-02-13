import React from "react";
import { Sparkles } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  onProvenanceClick?: () => void;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, onProvenanceClick }) => (
  <div className="relative group inline-flex items-center">
    <span className="text-xs bg-vc-surface-2 px-2 py-1 rounded shadow border border-vc-border-default">
      {text}
    </span>
    <button
      className="ml-1 p-1 rounded-full hover:bg-indigo-100 transition-colors"
      aria-label="Show provenance"
      onClick={onProvenanceClick}
      tabIndex={0}
      type="button"
    >
      <Sparkles className="w-4 h-4 text-indigo-500" />
    </button>
  </div>
);
