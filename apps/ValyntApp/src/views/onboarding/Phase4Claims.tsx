import { useState } from "react";
import { Shield, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingPhase4Input, CompanyClaimGovernance } from "@/hooks/company-context/types";

interface Props {
  companyName: string;
  onNext: (data: OnboardingPhase4Input) => void;
  onBack: () => void;
}

type RiskLevel = CompanyClaimGovernance["risk_level"];
type Category = NonNullable<CompanyClaimGovernance["category"]>;

interface ClaimDraft {
  claim_text: string;
  risk_level: RiskLevel;
  category: Category;
  rationale: string;
}

export function Phase4Claims({ companyName, onNext, onBack }: Props) {
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
