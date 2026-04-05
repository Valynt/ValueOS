/**
 * Domain Pack Merge Logic
 *
 * Pure functions for overlaying a child pack on top of a parent.
 * Child entries override parent entries by key; unmatched parent
 * entries are preserved.
 */

import type {
  DomainPack,
  DomainPackAssumption,
  DomainPackKpi,
  EffectiveDomainPack,
} from '../../api/domain-packs/types.js';

// ============================================================================
// KPI Merge
// ============================================================================

/**
 * Merge KPI arrays. Child KPIs override parent KPIs by `kpiKey`.
 * Parent KPIs not present in the child are kept.
 * Child KPIs not present in the parent are appended.
 */
export function mergeKpis(
  parentKpis: readonly DomainPackKpi[],
  childKpis: readonly DomainPackKpi[],
): DomainPackKpi[] {
  const childMap = new Map(childKpis.map((k) => [k.kpiKey, k]));
  const merged: DomainPackKpi[] = [];
  const seen = new Set<string>();

  // Walk parent order, override with child where key matches
  for (const parent of parentKpis) {
    const child = childMap.get(parent.kpiKey);
    merged.push(child ?? parent);
    seen.add(parent.kpiKey);
  }

  // Append child-only KPIs (not in parent)
  for (const child of childKpis) {
    if (!seen.has(child.kpiKey)) {
      merged.push(child);
    }
  }

  return merged;
}

// ============================================================================
// Assumption Merge
// ============================================================================

/**
 * Merge assumption arrays. Child assumptions override parent by `assumptionKey`.
 * Same ordering semantics as KPI merge.
 */
export function mergeAssumptions(
  parentAssumptions: readonly DomainPackAssumption[],
  childAssumptions: readonly DomainPackAssumption[],
): DomainPackAssumption[] {
  const childMap = new Map(childAssumptions.map((a) => [a.assumptionKey, a]));
  const merged: DomainPackAssumption[] = [];
  const seen = new Set<string>();

  for (const parent of parentAssumptions) {
    const child = childMap.get(parent.assumptionKey);
    merged.push(child ?? parent);
    seen.add(parent.assumptionKey);
  }

  for (const child of childAssumptions) {
    if (!seen.has(child.assumptionKey)) {
      merged.push(child);
    }
  }

  return merged;
}

// ============================================================================
// Full Pack Merge
// ============================================================================

/**
 * Produce an EffectiveDomainPack by overlaying `child` on `parent`.
 * The child's metadata (name, industry, version) wins.
 */
export function mergePack(
  parent: DomainPack,
  child: DomainPack,
): EffectiveDomainPack {
  return {
    packId: child.id,
    parentPackId: parent.id,
    name: child.name,
    industry: child.industry,
    version: child.version,
    kpis: mergeKpis(parent.kpis, child.kpis),
    assumptions: mergeAssumptions(parent.assumptions, child.assumptions),
  };
}

/**
 * Convert a standalone pack (no parent) to an EffectiveDomainPack.
 */
export function packToEffective(pack: DomainPack): EffectiveDomainPack {
  return {
    packId: pack.id,
    parentPackId: pack.parentPackId,
    name: pack.name,
    industry: pack.industry,
    version: pack.version,
    kpis: [...pack.kpis],
    assumptions: [...pack.assumptions],
  };
}
