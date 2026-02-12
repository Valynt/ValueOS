import { useState } from "react";
import {
  CheckCircle2,
  Building2,
  Swords,
  Users,
  Shield,
  Package,
  Sparkles,
  ExternalLink,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  OnboardingPhase1Input,
  OnboardingPhase2Input,
  OnboardingPhase3Input,
  OnboardingPhase4Input,
  ResearchSuggestion,
} from "@/hooks/company-context/types";

interface Props {
  phase1: OnboardingPhase1Input;
  phase2: OnboardingPhase2Input;
  phase3: OnboardingPhase3Input;
  phase4: OnboardingPhase4Input;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  researchJobId?: string | null;
  researchSuggestions?: ResearchSuggestion[];
}

function SectionCard({
  icon: Icon,
  title,
  count,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function ProvenanceBadge({ suggestion }: { suggestion?: ResearchSuggestion | undefined }) {
  const [showSources, setShowSources] = useState(false);

  if (!suggestion || suggestion.status !== "accepted") return null;

  return (
    <div className="inline-flex items-center gap-1 ml-2">
      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
        <Bot className="w-2.5 h-2.5" />
        AI · {Math.round(suggestion.confidence_score * 100)}%
      </span>
      {suggestion.source_urls.length > 0 && (
        <button
          onClick={() => setShowSources(!showSources)}
          className="text-[9px] text-zinc-400 hover:text-zinc-600"
        >
          {suggestion.source_urls.length} source{suggestion.source_urls.length !== 1 ? "s" : ""}
        </button>
      )}
      {showSources && (
        <div className="absolute mt-6 p-2 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 space-y-1">
          {suggestion.source_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700"
            >
              <ExternalLink className="w-3 h-3" />
              {url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Phase5Review({ phase1, phase2, phase3, phase4, onConfirm, onBack, isSubmitting, researchJobId, researchSuggestions }: Props) {
  const acceptedSuggestions = researchSuggestions?.filter((s) => s.status === "accepted") ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Review & Activate</h2>
          <p className="text-[12px] text-zinc-400">
            Confirm your company intelligence — this becomes the foundation for every value case
          </p>
        </div>
      </div>

      {/* Research provenance summary */}
      {acceptedSuggestions.length > 0 && (
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500" />
            <span className="text-[12px] font-semibold text-blue-700">
              AI-Assisted Onboarding
            </span>
          </div>
          <p className="text-[11px] text-blue-600">
            {acceptedSuggestions.length} item{acceptedSuggestions.length !== 1 ? "s" : ""} were
            suggested by AI and accepted during this onboarding.
            {researchJobId && (
              <span className="text-blue-400 ml-1">Job: {researchJobId.substring(0, 8)}...</span>
            )}
          </p>
        </div>
      )}

      {/* Company summary */}
      <SectionCard icon={Building2} title="Company" count={1} color="text-blue-600">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-zinc-400">Name</p>
            <p className="text-[13px] font-medium text-zinc-900">{phase1.company_name}</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400">Industry</p>
            <p className="text-[13px] font-medium text-zinc-900">{phase1.industry || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400">Size</p>
            <p className="text-[13px] font-medium text-zinc-900 capitalize">
              {phase1.company_size?.replace("_", " ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400">Sales Motion</p>
            <p className="text-[13px] font-medium text-zinc-900 capitalize">
              {phase1.sales_motion?.replace("_", " ") || "—"}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Products */}
      <SectionCard icon={Package} title="Products" count={phase1.products.length} color="text-blue-600">
        <div className="space-y-2">
          {phase1.products.map((p, i) => {
            const matchingSuggestion = acceptedSuggestions.find(
              (s) => s.entity_type === "product" && (s.payload as Record<string, string>).name === p.name
            );
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 relative">
                <span className="text-[13px] font-medium text-zinc-900 flex-1">{p.name}</span>
                <span className="text-[11px] text-zinc-400 capitalize">{p.product_type?.replace("_", " ")}</span>
                <ProvenanceBadge suggestion={matchingSuggestion} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Competitors */}
      {phase2.competitors.length > 0 && (
        <SectionCard icon={Swords} title="Competitors" count={phase2.competitors.length} color="text-violet-600">
          <div className="flex flex-wrap gap-2">
            {phase2.competitors.map((c, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-violet-50 text-[12px] font-medium text-violet-700 border border-violet-100">
                {c.name}
                <span className="text-violet-400 ml-1 capitalize"> · {c.relationship}</span>
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Personas */}
      {phase3.personas.length > 0 && (
        <SectionCard icon={Users} title="Buyer Personas" count={phase3.personas.length} color="text-emerald-600">
          <div className="space-y-2">
            {phase3.personas.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50">
                <span className="text-[13px] font-medium text-zinc-900 flex-1">{p.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold capitalize">
                  {p.persona_type?.replace("_", " ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold capitalize">
                  {p.seniority?.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Claim governance */}
      {phase4.claim_governance.length > 0 && (
        <SectionCard icon={Shield} title="Claim Governance" count={phase4.claim_governance.length} color="text-amber-600">
          <div className="space-y-2">
            {phase4.claim_governance.map((c, i) => {
              const riskColors = {
                safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
                conditional: "bg-amber-50 text-amber-700 border-amber-200",
                high_risk: "bg-red-50 text-red-700 border-red-200",
              };
              return (
                <div key={i} className="p-3 rounded-xl bg-zinc-50">
                  <div className="flex items-start gap-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 mt-0.5", riskColors[c.risk_level])}>
                      {c.risk_level.replace("_", " ")}
                    </span>
                    <p className="text-[12px] text-zinc-700">{c.claim_text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Confirm */}
      <div className="p-5 rounded-2xl bg-zinc-950 text-white">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-[14px] font-semibold">Ready to activate</h3>
        </div>
        <p className="text-[12px] text-zinc-400 mb-4">
          Once activated, this intelligence becomes the foundation for every value case.
          You can always update it later from the Company Knowledge page.
        </p>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-3 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-white transition-colors">
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-3 bg-white text-zinc-950 rounded-xl text-[13px] font-semibold hover:bg-zinc-100 transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isSubmitting ? "Activating..." : "Activate Company Intelligence"}
          </button>
        </div>
      </div>
    </div>
  );
}
