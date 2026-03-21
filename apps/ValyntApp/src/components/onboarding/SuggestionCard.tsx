/**
 * SuggestionCard — renders a single AI-generated suggestion with
 * Accept/Edit/Reject actions, confidence badge, and source count.
 */

import { Check, ExternalLink, Pencil, Sparkles, X } from "lucide-react";
import { useState } from "react";

import type { ResearchSuggestion } from "@/hooks/company-context/types";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

interface Props {
  suggestion: ResearchSuggestion;
  onAccept: (suggestion: ResearchSuggestion) => void;
  onReject: (suggestion: ResearchSuggestion) => void;
  onEdit: (suggestion: ResearchSuggestion, editedPayload: Record<string, unknown>) => void;
  renderPayload: (payload: Record<string, unknown>, isEditing: boolean, onPayloadChange: (payload: Record<string, unknown>) => void) => React.ReactNode;
  isProcessing?: boolean;
}


function getSourceName(url: string): string {
  if (url.startsWith("sec://edgar")) {
    const parts = url.split("/");
    const section = parts[parts.length - 1];
    return `SEC 10-K (${section.replace(/_/g, " ")})`;
  }
  if (url.includes("sec.gov")) return "SEC Filing";
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch {
    return "Website";
  }
}

function SourceBadge({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  const firstName = getSourceName(urls[0]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 text-[9px] font-medium">
      <ExternalLink className="w-2.5 h-2.5" />
      {urls.length === 1 ? firstName : `${firstName} +${urls.length - 1}`}
    </div>
  );
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onEdit,
  renderPayload,
  isProcessing = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPayload, setEditedPayload] = useState<Record<string, unknown>>(
    suggestion.payload as Record<string, unknown>,
  );

  if (suggestion.status !== "suggested") return null;

  const handleAcceptEdit = () => {
    onEdit(suggestion, editedPayload);
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-500">
          AI Suggested
        </span>
        <ConfidenceBadge score={suggestion.confidence_score} />
        <div className="ml-auto">
          <SourceBadge urls={suggestion.source_urls} />
        </div>
      </div>

      {/* Payload content */}
      <div>
        {renderPayload(
          isEditing ? editedPayload : (suggestion.payload as Record<string, unknown>),
          isEditing,
          setEditedPayload,
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isEditing ? (
          <>
            <button
              onClick={handleAcceptEdit}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Save & Accept
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedPayload(suggestion.payload as Record<string, unknown>);
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onAccept(suggestion)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Accept
            </button>
            <button
              onClick={() => setIsEditing(true)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => onReject(suggestion)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * SuggestionSection — wraps a list of suggestions for a given entity type.
 * Renders above the manual entry area.
 */
export function SuggestionSection({
  suggestions,
  onAccept,
  onReject,
  onEdit,
  renderPayload,
  isProcessing,
}: {
  suggestions: ResearchSuggestion[];
  onAccept: (s: ResearchSuggestion) => void;
  onReject: (s: ResearchSuggestion) => void;
  onEdit: (s: ResearchSuggestion, payload: Record<string, unknown>) => void;
  renderPayload: Props["renderPayload"];
  isProcessing?: boolean;
}) {
  const pending = suggestions.filter((s) => s.status === "suggested");
  if (pending.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" />
        <h3 className="text-[12px] font-semibold text-blue-600">
          AI Suggestions ({pending.length})
        </h3>
      </div>
      {pending.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          onAccept={onAccept}
          onReject={onReject}
          onEdit={onEdit}
          renderPayload={renderPayload}
          isProcessing={isProcessing ?? false}
        />
      ))}
    </div>
  );
}
