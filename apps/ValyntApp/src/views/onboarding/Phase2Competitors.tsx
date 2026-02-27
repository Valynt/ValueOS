import { useState } from "react";
import { Plus, Swords, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyCompetitor, OnboardingPhase2Input } from "@/hooks/company-context/types";
import { useAcceptSuggestion, useRejectSuggestion, useResearchSuggestions } from "@/hooks/company-context/useResearchJob";
import { SuggestionSection } from "@/components/onboarding/SuggestionCard";
import { useTenant } from "@/contexts/TenantContext";

interface Props {
  onNext: (data: OnboardingPhase2Input) => void;
  onBack: () => void;
  researchJobId?: string | null;
}

type Relationship = NonNullable<CompanyCompetitor["relationship"]>;

export function Phase2Competitors({ onNext, onBack, researchJobId }: Props) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? "default";
  const { data: suggestions } = useResearchSuggestions(researchJobId ?? null, "competitor");
  const acceptMutation = useAcceptSuggestion(tenantId);
  const rejectMutation = useRejectSuggestion(tenantId);

  const [competitors, setCompetitors] = useState<
    Array<{ name: string; website_url: string; relationship: Relationship }>
  >([{ name: "", website_url: "", relationship: "direct" }]);

  const add = () => setCompetitors([...competitors, { name: "", website_url: "", relationship: "direct" }]);
  const remove = (i: number) => setCompetitors(competitors.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, value: string) => {
    setCompetitors(competitors.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const filled = competitors.filter((c) => c.name.trim().length > 0);

  const relationships: Array<{ value: Relationship; label: string }> = [
    { value: "direct", label: "Direct" },
    { value: "indirect", label: "Indirect" },
    { value: "incumbent", label: "Incumbent" },
    { value: "emerging", label: "Emerging" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
          <Swords className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Competitive Landscape</h2>
          <p className="text-[12px] text-zinc-400">Name your competitors so the system knows what to lean into and what to avoid</p>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <SuggestionSection
          suggestions={suggestions}
          onAccept={(s) => {
            acceptMutation.mutate({
              suggestionId: s.id,
              contextId: s.context_id,
              entityType: s.entity_type,
              payload: s.payload as Record<string, unknown>,
            });
            // Also add to local list
            const p = s.payload as Record<string, string>;
            setCompetitors((prev) => [
              ...prev.filter((c) => c.name.trim().length > 0),
              { name: p.name ?? "", website_url: p.website_url ?? "", relationship: (p.relationship ?? "direct") as Relationship },
            ]);
          }}
          onReject={(s) => rejectMutation.mutate(s.id)}
          onEdit={(s, payload) => {
            acceptMutation.mutate({
              suggestionId: s.id,
              contextId: s.context_id,
              entityType: s.entity_type,
              payload,
            });
          }}
          renderPayload={(payload, _isEditing, _onChange) => {
            const p = payload as Record<string, string>;
            return (
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-zinc-900">{p.name}</p>
                {p.website_url && <p className="text-[11px] text-zinc-400">{p.website_url}</p>}
                {p.relationship && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 capitalize">
                    {p.relationship}
                  </span>
                )}
              </div>
            );
          }}
          isProcessing={acceptMutation.isPending || rejectMutation.isPending}
        />
      )}

      <div className="space-y-3">
        {competitors.map((c, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={c.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                  placeholder="Competitor name"
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
                />
                <input
                  value={c.website_url}
                  onChange={(e) => update(i, "website_url", e.target.value)}
                  placeholder="Website (optional)"
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
              <div className="flex gap-1.5">
                {relationships.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => update(i, "relationship", r.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                      c.relationship === r.value
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {competitors.length > 1 && (
              <button onClick={() => remove(i)} className="p-1 rounded hover:bg-zinc-200 mt-1">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-zinc-300 rounded-xl text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full justify-center"
      >
        <Plus className="w-3 h-3" /> Add Competitor
      </button>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">
          Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onNext({ competitors: [] })}
            className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onNext({ competitors: filled })}
            disabled={filled.length === 0}
            className={cn(
              "px-6 py-3 rounded-xl text-[13px] font-medium transition-colors",
              filled.length > 0
                ? "bg-zinc-950 text-white hover:bg-zinc-800"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            )}
          >
            Continue ({filled.length})
          </button>
        </div>
      </div>
    </div>
  );
}
