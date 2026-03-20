import {
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Package,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { useTenant } from "@/contexts/TenantContext";
import type {
  OnboardingPhase1Input,
  OnboardingPhase2Input,
  OnboardingPhase3Input,
  OnboardingPhase4Input,
  ResearchSuggestion,
} from "@/hooks/company-context/types";
import { useAcceptSuggestion, useRejectSuggestion } from "@/hooks/company-context/useResearchJob";
import { cn } from "@/lib/utils";

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
  badge,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {badge}
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function ProvenanceBadge({ suggestion }: { suggestion?: ResearchSuggestion }) {
  const [showSources, setShowSources] = useState(false);

  if (!suggestion || (suggestion.status !== "accepted" && suggestion.status !== "edited")) return null;

  return (
    <div className="inline-flex items-center gap-1 ml-2">
      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
        <Bot className="w-2.5 h-2.5" />
        AI · {Math.round(suggestion.confidence_score * 100)}%
      </span>
      {suggestion.source_urls.length > 0 && (
        <button
          onClick={() => setShowSources(!showSources)}
          className="text-[9px] text-muted-foreground hover:text-muted-foreground"
        >
          {suggestion.source_urls.length} source{suggestion.source_urls.length !== 1 ? "s" : ""}
        </button>
      )}
      {showSources && (
        <div className="absolute mt-6 p-2 bg-card border border-border rounded-lg shadow-lg z-10 space-y-1">
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
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? "default";
  const acceptMutation = useAcceptSuggestion(tenantId);
  const rejectMutation = useRejectSuggestion(tenantId);

  const acceptedSuggestions = researchSuggestions?.filter((s) => s.status === "accepted" || s.status === "edited") ?? [];
  const pendingCapabilities = researchSuggestions?.filter((s) => s.entity_type === "capability" && s.status === "suggested") ?? [];
  const pendingPatterns = researchSuggestions?.filter((s) => s.entity_type === "value_pattern" && s.status === "suggested") ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Review & Activate</h2>
          <p className="text-[12px] text-muted-foreground">
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
            <p className="text-[11px] text-muted-foreground">Name</p>
            <p className="text-[13px] font-medium text-foreground">{phase1.company_name}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Industry</p>
            <p className="text-[13px] font-medium text-foreground">{phase1.industry || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Size</p>
            <p className="text-[13px] font-medium text-foreground capitalize">
              {phase1.company_size?.replace("_", " ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Sales Motion</p>
            <p className="text-[13px] font-medium text-foreground capitalize">
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
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface relative">
                <span className="text-[13px] font-medium text-foreground flex-1">{p.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize">{p.product_type?.replace("_", " ")}</span>
                <ProvenanceBadge suggestion={matchingSuggestion} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Advanced AI Insights (Capabilities & Patterns) */}
      {(pendingCapabilities.length > 0 || pendingPatterns.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="text-[14px] font-bold text-foreground">Advanced AI Insights</h3>
          </div>

          {pendingCapabilities.length > 0 && (
            <SectionCard
              icon={Zap}
              title="Suggested Capabilities"
              count={pendingCapabilities.length}
              color="text-blue-500"
              badge={<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-100">NEW</span>}
            >
              <div className="space-y-3">
                {pendingCapabilities.map((s) => {
                  const p = s.payload as Record<string, unknown>;
                  const capability = typeof p.capability === "string" ? p.capability : "";
                  const operational_change = typeof p.operational_change === "string" ? p.operational_change : "";
                  return (
                    <div key={s.id} className="p-3 rounded-xl border border-blue-100 bg-blue-50/20 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">{capability}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{operational_change}</p>
                      </div>
                      <button
                        onClick={() => acceptMutation.mutate({
                          suggestionId: s.id,
                          contextId: s.context_id,
                          entityType: s.entity_type,
                          payload: s.payload as Record<string, unknown>,
                        })}
                        disabled={acceptMutation.isPending}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Accept
                      </button>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {pendingPatterns.length > 0 && (
            <SectionCard
              icon={TrendingUp}
              title="Suggested Value Patterns"
              count={pendingPatterns.length}
              color="text-emerald-500"
              badge={<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-100">NEW</span>}
            >
              <div className="space-y-3">
                {pendingPatterns.map((s) => {
                  const p = s.payload as Record<string, unknown>;
                  const pattern_name = typeof p.pattern_name === "string" ? p.pattern_name : "";
                  const typical_kpis = Array.isArray(p.typical_kpis) ? p.typical_kpis : [];
                  return (
                    <div key={s.id} className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">{pattern_name}</p>
                        <div className="flex gap-2 mt-1">
                          {typical_kpis.slice(0, 2).map((k: unknown, idx: number) => {
                            if (typeof k === "object" && k !== null) {
                              const kObj = k as { name?: string };
                              return kObj.name ? (
                                <span key={idx} className="text-[10px] text-emerald-600 font-medium">
                                  • {kObj.name}
                                </span>
                              ) : null;
                            }
                            return null;
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => acceptMutation.mutate({
                          suggestionId: s.id,
                          contextId: s.context_id,
                          entityType: s.entity_type,
                          payload: s.payload as Record<string, unknown>,
                        })}
                        disabled={acceptMutation.isPending}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        Accept
                      </button>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}

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
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface">
                <span className="text-[13px] font-medium text-foreground flex-1">{p.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold capitalize">
                  {p.persona_type?.replace("_", " ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold capitalize">
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
              const riskColors: Record<string, string> = {
                safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
                conditional: "bg-amber-50 text-amber-700 border-amber-200",
                high_risk: "bg-red-50 text-red-700 border-red-200",
              };
              return (
                <div key={i} className="p-3 rounded-xl bg-surface">
                  <div className="flex items-start gap-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 mt-0.5", riskColors[c.risk_level])}>
                      {c.risk_level.replace("_", " ")}
                    </span>
                    <p className="text-[12px] text-muted-foreground">{c.claim_text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Confirm */}
      <div className="p-5 rounded-2xl bg-background text-white">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-[14px] font-semibold">Ready to activate</h3>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">
          Once activated, this intelligence becomes the foundation for every value case.
          You can always update it later from the Company Knowledge page.
        </p>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-3 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-white transition-colors">
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-3 bg-card text-zinc-950 rounded-xl text-[13px] font-semibold hover:bg-muted transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-border border-t-zinc-900 rounded-full animate-spin" />
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