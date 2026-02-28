import { Plus, Shield, X } from "lucide-react";
import { useState } from "react";

import { SuggestionSection } from "@/components/onboarding/SuggestionCard";
import { useTenant } from "@/contexts/TenantContext";
import type { CompanyClaimGovernance, OnboardingPhase4Input } from "@/hooks/company-context/types";
import { useAcceptSuggestion, useRejectSuggestion, useResearchSuggestions } from "@/hooks/company-context/useResearchJob";
import { cn } from "@/lib/utils";

interface Props {
  companyName: string;
  onNext: (data: OnboardingPhase4Input) => void;
  onBack: () => void;
  researchJobId?: string | null;
}

type RiskLevel = CompanyClaimGovernance["risk_level"];
type Category = NonNullable<CompanyClaimGovernance["category"]>;

interface ClaimDraft {
  claim_text: string;
  risk_level: RiskLevel;
  category: Category;
  rationale: string;
}

export function Phase4Claims({ companyName, onNext, onBack, researchJobId }: Props) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? "default";
  const { data: suggestions } = useResearchSuggestions(researchJobId ?? null, "claim");
  const acceptMutation = useAcceptSuggestion(tenantId);
  const rejectMutation = useRejectSuggestion(tenantId);

  const [claims, setClaims] = useState<ClaimDraft[]>([
    { claim_text: "", risk_level: "safe", category: "revenue", rationale: "" },
  ]);

  const add = () => setClaims([...claims, { claim_text: "", risk_level: "safe", category: "cost", rationale: "" }]);
  const remove = (i: number) => setClaims(claims.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof ClaimDraft, value: string) => {
    setClaims(claims.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const filled = claims.filter((c) => c.claim_text.trim().length > 0);

  const riskLevels: Array<{ value: RiskLevel; label: string; color: string; bg: string }> = [
    { value: "safe", label: "Safe", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { value: "conditional", label: "Conditional", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    { value: "high_risk", label: "High Risk", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  ];

  const categories: Array<{ value: Category; label: string }> = [
    { value: "revenue", label: "Revenue" },
    { value: "cost", label: "Cost" },
    { value: "risk", label: "Risk" },
    { value: "productivity", label: "Productivity" },
    { value: "compliance", label: "Compliance" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Claim Governance</h2>
          <p className="text-[12px] text-zinc-400">
            What claims should {companyName} make confidently, cautiously, or avoid?
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-[12px] text-blue-700">
          These rules teach the system which value claims are safe to make, which need extra evidence,
          and which should be flagged automatically. This prevents embarrassing overstatements in front of CFOs.
        </p>
      </div>

      {/* AI Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <SuggestionSection
          suggestions={suggestions.map((s) => {
            // Claims with confidence < 0.5 default to "conditional"
            if (s.confidence_score < 0.5) {
              return {
                ...s,
                payload: { ...s.payload, risk_level: "conditional" },
              };
            }
            return s;
          })}
          onAccept={(s) => {
            const payload = s.payload as Record<string, unknown>;
            // Enforce confidence-based risk defaulting
            if (s.confidence_score < 0.5) {
              payload.risk_level = "conditional";
            }
            acceptMutation.mutate({
              suggestionId: s.id,
              contextId: s.context_id,
              entityType: s.entity_type,
              payload,
            });
            const p = payload as Record<string, string>;
            setClaims((prev) => [
              ...prev.filter((c) => c.claim_text.trim().length > 0),
              {
                claim_text: p.claim_text ?? "",
                risk_level: (p.risk_level ?? "conditional") as RiskLevel,
                category: (p.category ?? "revenue") as Category,
                rationale: p.rationale ?? "",
              },
            ]);
          }}
          onReject={(s) => rejectMutation.mutate(s.id)}
          onEdit={(s, payload) => {
            if (s.confidence_score < 0.5) {
              payload.risk_level = "conditional";
            }
            acceptMutation.mutate({
              suggestionId: s.id,
              contextId: s.context_id,
              entityType: s.entity_type,
              payload,
            });
          }}
          renderPayload={(payload, _isEditing, _onChange) => {
            const p = payload as Record<string, string>;
            const riskColors: Record<string, string> = {
              safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
              conditional: "bg-amber-50 text-amber-700 border-amber-200",
              high_risk: "bg-red-50 text-red-700 border-red-200",
            };
            return (
              <div className="space-y-1.5">
                <p className="text-[12px] text-zinc-700">{p.claim_text}</p>
                <div className="flex items-center gap-2">
                  {p.risk_level && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize", riskColors[p.risk_level] ?? "bg-zinc-100 text-zinc-500")}>
                      {p.risk_level.replace("_", " ")}
                    </span>
                  )}
                  {p.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 capitalize">
                      {p.category}
                    </span>
                  )}
                </div>
                {p.rationale && <p className="text-[11px] text-zinc-400">{p.rationale}</p>}
              </div>
            );
          }}
          isProcessing={acceptMutation.isPending || rejectMutation.isPending}
        />
      )}

      <div className="space-y-4">
        {claims.map((c, i) => (
          <div key={i} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
            <div className="flex items-start gap-2">
              <textarea
                value={c.claim_text}
                onChange={(e) => update(i, "claim_text", e.target.value)}
                placeholder='e.g. "Our platform reduces infrastructure costs by 60%"'
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400 resize-none"
              />
              {claims.length > 1 && (
                <button onClick={() => remove(i)} className="p-1 rounded hover:bg-zinc-200">
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                {riskLevels.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => update(i, "risk_level", r.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                      c.risk_level === r.value ? cn(r.color, r.bg) : "border-zinc-200 text-zinc-500"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <select
                value={c.category}
                onChange={(e) => update(i, "category", e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-[11px] bg-white text-zinc-600 outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <input
              value={c.rationale}
              onChange={(e) => update(i, "rationale", e.target.value)}
              placeholder="Why this risk level? (optional)"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-[12px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400"
            />
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-zinc-300 rounded-xl text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full justify-center"
      >
        <Plus className="w-3 h-3" /> Add Claim Rule
      </button>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">
          Back
        </button>
        <div className="flex gap-2">
          <button onClick={() => onNext({ claim_governance: [] })} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
            Skip
          </button>
          <button
            onClick={() => onNext({ claim_governance: filled })}
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
