import { useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyPersona, OnboardingPhase3Input } from "@/hooks/company-context/types";
import { useAcceptSuggestion, useRejectSuggestion, useResearchSuggestions } from "@/hooks/company-context/useResearchJob";
import { SuggestionSection } from "@/components/onboarding/SuggestionCard";
import { useTenant } from "@/contexts/TenantContext";

interface Props {
  onNext: (data: OnboardingPhase3Input) => void;
  onBack: () => void;
  researchJobId?: string | null;
}

type PersonaType = NonNullable<CompanyPersona["persona_type"]>;
type Seniority = NonNullable<CompanyPersona["seniority"]>;

interface PersonaDraft {
  title: string;
  persona_type: PersonaType;
  seniority: Seniority;
  kpis: string;
  pains: string;
}

export function Phase3Personas({ onNext, onBack, researchJobId }: Props) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? "default";
  const { data: suggestions } = useResearchSuggestions(researchJobId ?? null, "persona");
  const acceptMutation = useAcceptSuggestion(tenantId);
  const rejectMutation = useRejectSuggestion(tenantId);

  const [personas, setPersonas] = useState<PersonaDraft[]>([
    { title: "", persona_type: "decision_maker", seniority: "vp", kpis: "", pains: "" },
  ]);

  const add = () =>
    setPersonas([...personas, { title: "", persona_type: "champion", seniority: "director", kpis: "", pains: "" }]);
  const remove = (i: number) => setPersonas(personas.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof PersonaDraft, value: string) => {
    setPersonas(personas.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const filled = personas.filter((p) => p.title.trim().length > 0);

  const types: Array<{ value: PersonaType; label: string }> = [
    { value: "decision_maker", label: "Decision Maker" },
    { value: "champion", label: "Champion" },
    { value: "influencer", label: "Influencer" },
    { value: "end_user", label: "End User" },
    { value: "blocker", label: "Blocker" },
  ];

  const seniorities: Array<{ value: Seniority; label: string }> = [
    { value: "c_suite", label: "C-Suite" },
    { value: "vp", label: "VP" },
    { value: "director", label: "Director" },
    { value: "manager", label: "Manager" },
    { value: "individual_contributor", label: "IC" },
  ];

  const handleSubmit = () => {
    onNext({
      personas: filled.map((p) => ({
        title: p.title.trim(),
        persona_type: p.persona_type,
        seniority: p.seniority,
        typical_kpis: p.kpis
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        pain_points: p.pains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Buyer Personas</h2>
          <p className="text-[12px] text-zinc-400">Who buys from you? This shapes how value narratives are framed</p>
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
            const p = s.payload as Record<string, any>;
            setPersonas((prev) => [
              ...prev.filter((x) => x.title.trim().length > 0),
              {
                title: p.title ?? "",
                persona_type: p.persona_type ?? "champion",
                seniority: p.seniority ?? "director",
                kpis: Array.isArray(p.typical_kpis) ? p.typical_kpis.join(", ") : "",
                pains: Array.isArray(p.pain_points) ? p.pain_points.join(", ") : "",
              },
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
            const p = payload as Record<string, any>;
            return (
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-zinc-900">{p.title}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {p.persona_type && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                      {String(p.persona_type).replace("_", " ")}
                    </span>
                  )}
                  {p.seniority && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 capitalize">
                      {String(p.seniority).replace("_", " ")}
                    </span>
                  )}
                </div>
                {Array.isArray(p.typical_kpis) && p.typical_kpis.length > 0 && (
                  <p className="text-[11px] text-zinc-500">KPIs: {p.typical_kpis.join(", ")}</p>
                )}
                {Array.isArray(p.pain_points) && p.pain_points.length > 0 && (
                  <p className="text-[11px] text-zinc-500">Pains: {p.pain_points.join(", ")}</p>
                )}
              </div>
            );
          }}
          isProcessing={acceptMutation.isPending || rejectMutation.isPending}
        />
      )}

      <div className="space-y-4">
        {personas.map((p, i) => (
          <div key={i} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <input
                value={p.title}
                onChange={(e) => update(i, "title", e.target.value)}
                placeholder="e.g. VP of Engineering, CFO, Head of RevOps"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
              />
              {personas.length > 1 && (
                <button onClick={() => remove(i)} className="p-1 rounded hover:bg-zinc-200 ml-2">
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 self-center mr-1">Type:</span>
              {types.map((t) => (
                <button
                  key={t.value}
                  onClick={() => update(i, "persona_type", t.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors",
                    p.persona_type === t.value
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 text-zinc-500"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 self-center mr-1">Level:</span>
              {seniorities.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update(i, "seniority", s.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors",
                    p.seniority === s.value
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 text-zinc-500"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <input
              value={p.kpis}
              onChange={(e) => update(i, "kpis", e.target.value)}
              placeholder="KPIs they care about (comma-separated)"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-[12px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
            />
            <input
              value={p.pains}
              onChange={(e) => update(i, "pains", e.target.value)}
              placeholder="Pain points (comma-separated)"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-[12px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
            />
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-zinc-300 rounded-xl text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full justify-center"
      >
        <Plus className="w-3 h-3" /> Add Persona
      </button>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">
          Back
        </button>
        <div className="flex gap-2">
          <button onClick={() => onNext({ personas: [] })} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={filled.length === 0}
            className={cn(
              "px-6 py-3 rounded-xl text-[13px] font-medium transition-colors",
              filled.length > 0 ? "bg-zinc-950 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            )}
          >
            Continue ({filled.length})
          </button>
        </div>
      </div>
    </div>
  );
}
