/**
 * CopilotSuggestions — Warmth-contextual suggestion buttons
 *
 * Phase 2: Copilot Mode
 */

import type { WarmthState } from "@shared/domain/Warmth";

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
}

interface CopilotSuggestionsProps {
  warmth: WarmthState;
  onSelect: (suggestionId: string) => void;
}

const suggestionsByWarmth: Record<WarmthState, Suggestion[]> = {
  forming: [
    { id: "gather", label: "📊 Gather Data", prompt: "What data should we collect for this case?" },
    { id: "evidence", label: "📎 Find Evidence", prompt: "Help me identify evidence sources" },
    { id: "drivers", label: "🔍 Discover Drivers", prompt: "What are the key value drivers?" },
  ],
  firm: [
    { id: "review", label: "✓ Review Assumptions", prompt: "Review my current assumptions" },
    { id: "validate", label: "🔒 Validate Evidence", prompt: "Validate the evidence strength" },
    { id: "blindspots", label: "👁 Check Blind Spots", prompt: "What am I missing?" },
  ],
  verified: [
    { id: "share", label: "📤 Share Case", prompt: "Generate a shareable summary" },
    { id: "export", label: "📄 Export Report", prompt: "Export an executive report" },
    { id: "present", label: "📊 Prepare Presentation", prompt: "Create presentation slides" },
  ],
};

const warmthStyles: Record<WarmthState, string> = {
  forming: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  firm: "bg-blue-50 text-blue-800 hover:bg-blue-100",
  verified: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
};

export function CopilotSuggestions({ warmth, onSelect }: CopilotSuggestionsProps): JSX.Element {
  const suggestions = suggestionsByWarmth[warmth];

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${warmthStyles[warmth]}`}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

export default CopilotSuggestions;
