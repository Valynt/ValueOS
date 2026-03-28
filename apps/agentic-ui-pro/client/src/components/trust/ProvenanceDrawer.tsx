/**
 * ProvenanceDrawer
 *
 * Full derivation chain for a financial claim.
 * "Click a number → see exactly where it came from."
 * This is the core trust mechanism for CFO-defensible outputs.
 */

import { ArrowRight, Bot, ChevronRight, Database, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutiveArtifact, FinancialClaim } from '@/types/agent-ux';
import { ConfidenceBadge } from './ConfidenceBadge';
import { useAgentUXStore } from '@/lib/agent-ux-store';

interface ProvenanceDrawerProps {
  artifacts: ExecutiveArtifact[];
}

export function ProvenanceDrawer({ artifacts }: ProvenanceDrawerProps) {
  const { showProvenance, provenanceClaimId, closeProvenance } = useAgentUXStore();

  if (!showProvenance || !provenanceClaimId) return null;

  // Find the claim across all artifacts
  let claim: FinancialClaim | undefined;
  for (const artifact of artifacts) {
    claim = artifact.financialClaims.find((c) => c.id === provenanceClaimId);
    if (claim) break;
  }

  if (!claim) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={closeProvenance}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-[#0f0f12] border-l border-white/8 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-white">Claim Provenance</span>
          </div>
          <button
            onClick={closeProvenance}
            className="p-1 rounded hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Claim */}
          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <div className="text-xs text-violet-300 font-medium mb-1">Financial Claim</div>
            <div className="text-sm text-white font-medium">{claim.text}</div>
            <div className="text-lg font-bold text-white mt-1 font-mono">
              ${(claim.value / 1_000_000).toFixed(2)}M
            </div>
          </div>

          {/* Derivation chain */}
          <div>
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">
              Derivation Chain
            </div>
            <div className="space-y-2">
              {claim.derivationChain.map((step, i) => (
                <div key={i} className="relative">
                  {i < claim!.derivationChain.length - 1 && (
                    <div className="absolute left-4 top-full h-2 w-px bg-white/10 z-10" />
                  )}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/6">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white/60">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-white/80">{step.label}</span>
                        <ConfidenceBadge score={step.confidence} size="sm" showLabel={false} />
                      </div>
                      <div className="text-sm font-mono font-bold text-white">{step.value}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Database className="w-2.5 h-2.5 text-white/30" />
                        <span className="text-[10px] text-white/40">{step.source}</span>
                      </div>
                      {step.agentId && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Bot className="w-2.5 h-2.5 text-white/30" />
                          <span className="text-[10px] text-white/30">{step.agentId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs text-emerald-300 font-medium">Calculated Result</div>
              <div className="text-lg font-bold text-white font-mono">
                ${(claim.value / 1_000_000).toFixed(2)}M / year
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
