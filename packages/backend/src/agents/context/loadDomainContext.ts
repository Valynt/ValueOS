/**
 * Load Domain Context for Agents
 *
 * Provides agents with the effective domain pack (KPIs + assumptions)
 * for a given value case. Returns empty defaults when no pack is
 * attached or the repository is not yet wired.
 */

import type {
  EffectiveDomainPack,
  DomainPackKpi,
  DomainPackAssumption,
} from '../../api/domainPacks/types.js';
import {
  isDomainPackSnapshot,
  effectiveFromSnapshot,
} from '../../services/domainPacks/snapshot.js';
import type { DomainPackSnapshot } from '../../services/domainPacks/snapshot.js';
import {
  sanitizeKpiForPrompt,
  sanitizeAssumptionForPrompt,
  estimateTokens,
  LLM_LIMITS,
} from '../../services/domainPacks/validate.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface DomainContext {
  pack: EffectiveDomainPack | undefined;
  kpis: DomainPackKpi[];
  assumptions: DomainPackAssumption[];
}

const EMPTY_CONTEXT: DomainContext = Object.freeze({
  pack: undefined,
  kpis: [],
  assumptions: [],
});

// ============================================================================
// Loader
// ============================================================================

/**
 * Load the domain context for a value case.
 *
 * Strategy (snapshot-first for reproducibility):
 *   1. If the value case has a domain_pack_snapshot, reconstruct from it.
 *   2. Otherwise, fetch the live pack and merge (once repository is wired).
 *   3. If neither is available, return empty context.
 *
 * Current behavior (pre-repository wiring): always returns empty context.
 */
export async function loadDomainContext(
  _tenantId: string,
  _valueCaseId: string,
): Promise<DomainContext> {
  // TODO: Wire to repository once DomainPacksRepository is implemented
  //
  // const vcRepo = getValueCasesRepository();
  // const vc = await vcRepo.getById(tenantId, valueCaseId);
  //
  // // Prefer snapshot for reproducibility
  // if (vc.domainPackSnapshot && isDomainPackSnapshot(vc.domainPackSnapshot)) {
  //   return loadFromSnapshot(vc.domainPackSnapshot as unknown as DomainPackSnapshot);
  // }
  //
  // // Fall back to live pack
  // if (!vc.domainPackId) return EMPTY_CONTEXT;
  // const repo = getDomainPacksRepository();
  // const pack = await repo.getById(tenantId, vc.domainPackId);
  // let effective: EffectiveDomainPack;
  // if (pack.parentPackId) {
  //   const parent = await repo.getById(tenantId, pack.parentPackId);
  //   effective = mergePack(parent, pack);
  // } else {
  //   effective = packToEffective(pack);
  // }
  // return { pack: effective, kpis: effective.kpis, assumptions: effective.assumptions };

  logger.debug('loadDomainContext: returning empty context (repository not yet wired)', {
    _tenantId,
    _valueCaseId,
  });

  return { ...EMPTY_CONTEXT, kpis: [], assumptions: [] };
}

/**
 * Reconstruct domain context from a stored snapshot.
 * Used for CFO-grade reproducibility — the snapshot is immutable
 * and unaffected by later pack edits or deprecation.
 */
export function loadFromSnapshot(snapshot: DomainPackSnapshot): DomainContext {
  const effective = effectiveFromSnapshot(snapshot);
  return {
    pack: effective,
    kpis: effective.kpis,
    assumptions: effective.assumptions,
  };
}

/**
 * Format domain context as a prompt fragment for LLM consumption.
 * Sanitizes text fields and enforces token budget.
 * Returns empty string when no pack is loaded.
 */
export function formatDomainContextForPrompt(ctx: DomainContext): string {
  if (!ctx.pack || ctx.kpis.length === 0) return '';

  // Sanitize all text fields before prompt inclusion
  const safeKpis = ctx.kpis.map(sanitizeKpiForPrompt);
  const safeAssumptions = ctx.assumptions.map(sanitizeAssumptionForPrompt);

  const lines: string[] = [
    `\nDomain Pack: ${ctx.pack.name} (${ctx.pack.industry}, v${ctx.pack.version})`,
    '',
    'KPIs:',
  ];

  for (const kpi of safeKpis) {
    const parts = [`  - ${kpi.defaultName} (${kpi.kpiKey})`];
    if (kpi.unit) parts.push(`unit: ${kpi.unit}`);
    if (kpi.direction) parts.push(`direction: ${kpi.direction}`);
    if (kpi.baselineHint) parts.push(`baseline: ${kpi.baselineHint}`);
    if (kpi.targetHint) parts.push(`target: ${kpi.targetHint}`);
    lines.push(parts.join(', '));
  }

  if (safeAssumptions.length > 0) {
    lines.push('', 'Assumptions:');
    for (const a of safeAssumptions) {
      const value =
        a.valueType === 'number' ? String(a.valueNumber) :
        a.valueType === 'string' ? a.valueText :
        a.valueType === 'boolean' ? String(a.valueBool) :
        'JSON';
      const parts = [`  - ${a.assumptionKey}: ${value}`];
      if (a.unit) parts.push(`(${a.unit})`);
      if (a.rationale) parts.push(`— ${a.rationale}`);
      lines.push(parts.join(' '));
    }
  }

  const result = lines.join('\n');

  // Enforce token budget — truncate with notice if exceeded
  const tokens = estimateTokens(result);
  if (tokens > LLM_LIMITS.MAX_PROMPT_TOKENS) {
    const charBudget = LLM_LIMITS.MAX_PROMPT_TOKENS * 4;
    logger.warn('Domain context prompt fragment exceeds token budget, truncating', {
      estimatedTokens: tokens,
      limit: LLM_LIMITS.MAX_PROMPT_TOKENS,
    });
    return result.slice(0, charBudget) + '\n[Domain context truncated due to size]';
  }

  return result;
}
