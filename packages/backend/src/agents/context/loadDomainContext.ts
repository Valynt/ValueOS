/**
 * Load Domain Context for Agents
 *
 * Provides agents with the effective domain pack (KPIs + assumptions)
 * for a given value case. Uses snapshot-first strategy for reproducibility:
 *   1. If the value case has a domain_pack_snapshot, reconstruct from it.
 *   2. Otherwise, fetch the live pack via DomainPackService.
 *   3. If neither is available, return empty context.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DomainPackAssumption,
  DomainPackKpi,
  EffectiveDomainPack,
} from '../../api/domain-packs/types.js';
import { logger } from '../../lib/logger.js';
import { DomainPackService } from '../../services/domain-packs/DomainPackService.js';
import {
  effectiveFromSnapshot,
  isDomainPackSnapshot,
} from '../../services/domainPacks/snapshot.js';
import type { DomainPackSnapshot } from '../../services/domainPacks/snapshot.js';
import {
  estimateTokens,
  LLM_LIMITS,
  sanitizeAssumptionForPrompt,
  sanitizeKpiForPrompt,
} from '../../services/domainPacks/validate.js';

// ============================================================================
// Types
// ============================================================================

export interface DomainContext {
  pack: EffectiveDomainPack | undefined;
  kpis: DomainPackKpi[];
  assumptions: DomainPackAssumption[];
  /** Glossary mapping (neutral term → domain-specific term) */
  glossary: Record<string, string>;
  /** Compliance rules for the domain */
  complianceRules: string[];
}

const EMPTY_CONTEXT: DomainContext = Object.freeze({
  pack: undefined,
  kpis: [],
  assumptions: [],
  glossary: {},
  complianceRules: [],
});

// ============================================================================
// Loader
// ============================================================================

/**
 * Load the domain context for a value case.
 *
 * Accepts an optional SupabaseClient. When provided, queries the DB
 * using snapshot-first strategy. When omitted, returns empty context
 * (safe for unit tests and environments without DB access).
 */
export async function loadDomainContext(
  tenantId: string,
  valueCaseId: string,
  supabaseClient?: SupabaseClient,
): Promise<DomainContext> {
  if (!supabaseClient) {
    logger.debug('loadDomainContext: no supabase client, returning empty context', {
      tenantId,
      valueCaseId,
    });
    return { ...EMPTY_CONTEXT };
  }

  // 1. Fetch the value case to check for snapshot or pack ID
  const { data: vc, error: vcError } = await supabaseClient
    .from('value_cases')
    .select('id, domain_pack_id, domain_pack_snapshot')
    .eq('id', valueCaseId)
    .eq('organization_id', tenantId)
    .single();

  if (vcError || !vc) {
    logger.warn('loadDomainContext: value case not found', {
      tenantId,
      valueCaseId,
      error: vcError?.message,
    });
    return { ...EMPTY_CONTEXT };
  }

  // 2. Prefer snapshot for reproducibility
  if (vc.domain_pack_snapshot && isDomainPackSnapshot(vc.domain_pack_snapshot)) {
    return loadFromSnapshot(vc.domain_pack_snapshot as unknown as DomainPackSnapshot);
  }

  // 3. Fall back to live pack via DomainPackService
  if (!vc.domain_pack_id) {
    return { ...EMPTY_CONTEXT };
  }

  const service = new DomainPackService(supabaseClient);
  const packData = await service.getPackWithLayers(vc.domain_pack_id, tenantId);

  // Convert to DomainPackKpi[] format expected by agents
  const kpis: DomainPackKpi[] = packData.kpis.map((k) => ({
    kpiKey: k.kpi_key,
    defaultName: k.default_name,
    description: k.description ?? undefined,
    unit: k.unit ?? undefined,
    direction: k.direction === 'up' ? 'increase' : k.direction === 'down' ? 'decrease' : undefined,
    baselineHint: k.baseline_hint ?? undefined,
    targetHint: k.target_hint ?? undefined,
    defaultConfidence: 0.8,
    sortOrder: k.sort_order,
    tags: undefined,
  }));

  const assumptions: DomainPackAssumption[] = packData.assumptions.map((a) => ({
    assumptionKey: a.assumption_key,
    valueType: a.value_type as 'number' | 'string' | 'boolean' | 'json',
    valueNumber: a.value_number ?? undefined,
    valueText: a.value_text ?? undefined,
    valueBool: a.value_bool ?? undefined,
    valueJson: undefined,
    unit: a.unit ?? undefined,
    defaultConfidence: 0.9,
    rationale: a.description ?? undefined,
    evidenceRefs: [],
  }));

  return {
    pack: {
      packId: packData.pack.id,
      parentPackId: null,
      name: packData.pack.name,
      industry: packData.pack.industry,
      version: packData.pack.version,
      kpis,
      assumptions,
    },
    kpis,
    assumptions,
    glossary: (packData.pack as Record<string, unknown>).glossary as Record<string, string> ?? {},
    complianceRules: (packData.pack as Record<string, unknown>).compliance_rules as string[] ?? [],
  };
}

/**
 * Reconstruct domain context from a stored snapshot.
 * Used for CFO-grade reproducibility — the snapshot is immutable
 * and unaffected by later pack edits or deprecation.
 */
export function loadFromSnapshot(snapshot: DomainPackSnapshot): DomainContext {
  const effective = effectiveFromSnapshot(snapshot);
  const raw = snapshot as Record<string, unknown>;
  return {
    pack: effective,
    kpis: effective.kpis,
    assumptions: effective.assumptions,
    glossary: (raw.glossary as Record<string, string>) ?? {},
    complianceRules: (raw.complianceRules as string[]) ?? [],
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

  // Include glossary if present
  if (ctx.glossary && Object.keys(ctx.glossary).length > 0) {
    lines.push('', 'Terminology (use these domain-specific terms):');
    for (const [neutral, domain] of Object.entries(ctx.glossary)) {
      lines.push(`  - "${neutral}" → "${domain}"`);
    }
  }

  // Include compliance rules if present
  if (ctx.complianceRules && ctx.complianceRules.length > 0) {
    lines.push('', 'Compliance requirements:');
    for (const rule of ctx.complianceRules) {
      lines.push(`  - ${rule}`);
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
