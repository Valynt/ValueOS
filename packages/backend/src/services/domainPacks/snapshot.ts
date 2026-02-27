/**
 * Domain Pack Snapshot
 *
 * Captures a point-in-time snapshot of an EffectiveDomainPack so that
 * value cases are reproducible regardless of later pack edits or deprecation.
 *
 * The snapshot is a self-contained JSON blob stored on the value case.
 * It includes the resolved (merged) KPIs and assumptions at attachment time.
 */

import type {
  DomainPack,
  DomainPackAssumption,
  DomainPackKpi,
  EffectiveDomainPack,
} from '../../api/domainPacks/types.js';
import { mergePack, packToEffective } from './merge.js';

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Immutable snapshot stored as JSON on the value case row.
 * Contains everything needed to reconstruct the domain context
 * without querying the domain_packs tables.
 */
export interface DomainPackSnapshot {
  /** Schema version for forward-compatible deserialization. */
  schemaVersion: 1;

  /** ID of the pack that was attached. */
  packId: string;

  /** Parent pack ID (null if standalone). */
  parentPackId: string | null;

  /** Pack metadata at snapshot time. */
  name: string;
  industry: string;
  version: string;

  /** Resolved (merged) KPIs — parent + child overlay already applied. */
  kpis: DomainPackKpi[];

  /** Resolved (merged) assumptions — parent + child overlay already applied. */
  assumptions: DomainPackAssumption[];

  /** ISO 8601 timestamp when the snapshot was created. */
  snapshotCreatedAt: string;
}

// ============================================================================
// Snapshot Creation
// ============================================================================

/**
 * Create a snapshot from an EffectiveDomainPack.
 * The effective pack should already have parent+child merged.
 */
export function snapshotFromEffective(effective: EffectiveDomainPack): DomainPackSnapshot {
  return {
    schemaVersion: 1,
    packId: effective.packId,
    parentPackId: effective.parentPackId,
    name: effective.name,
    industry: effective.industry,
    version: effective.version,
    kpis: structuredClone(effective.kpis),
    assumptions: structuredClone(effective.assumptions),
    snapshotCreatedAt: new Date().toISOString(),
  };
}

/**
 * Create a snapshot from a standalone pack (no parent).
 */
export function snapshotPack(pack: DomainPack): DomainPackSnapshot {
  const effective = packToEffective(pack);
  return snapshotFromEffective(effective);
}

/**
 * Create a snapshot from a child pack with its parent.
 * Merges parent+child, then snapshots the result.
 */
export function snapshotMergedPack(
  parent: DomainPack,
  child: DomainPack,
): DomainPackSnapshot {
  const effective = mergePack(parent, child);
  return snapshotFromEffective(effective);
}

// ============================================================================
// Snapshot Reconstruction
// ============================================================================

/**
 * Reconstruct an EffectiveDomainPack from a snapshot.
 * Used by agents to load domain context from historical value cases.
 */
export function effectiveFromSnapshot(snapshot: DomainPackSnapshot): EffectiveDomainPack {
  return {
    packId: snapshot.packId,
    parentPackId: snapshot.parentPackId,
    name: snapshot.name,
    industry: snapshot.industry,
    version: snapshot.version,
    kpis: snapshot.kpis,
    assumptions: snapshot.assumptions,
  };
}

// ============================================================================
// Snapshot Validation
// ============================================================================

/**
 * Type guard for DomainPackSnapshot.
 * Validates the shape without Zod to keep this module dependency-light.
 */
export function isDomainPackSnapshot(value: unknown): value is DomainPackSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.schemaVersion === 1 &&
    typeof obj.packId === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.industry === 'string' &&
    typeof obj.version === 'string' &&
    Array.isArray(obj.kpis) &&
    Array.isArray(obj.assumptions) &&
    typeof obj.snapshotCreatedAt === 'string'
  );
}

/**
 * Compare a snapshot against the current effective pack to detect drift.
 * Returns a list of differences. Empty array means no drift.
 */
export interface SnapshotDrift {
  field: string;
  snapshotValue: string;
  currentValue: string;
}

export function detectDrift(
  snapshot: DomainPackSnapshot,
  current: EffectiveDomainPack,
): SnapshotDrift[] {
  const drifts: SnapshotDrift[] = [];

  if (snapshot.version !== current.version) {
    drifts.push({
      field: 'version',
      snapshotValue: snapshot.version,
      currentValue: current.version,
    });
  }

  // KPI key sets
  const snapshotKpiKeys = new Set(snapshot.kpis.map((k) => k.kpiKey));
  const currentKpiKeys = new Set(current.kpis.map((k) => k.kpiKey));

  for (const key of snapshotKpiKeys) {
    if (!currentKpiKeys.has(key)) {
      drifts.push({ field: `kpis`, snapshotValue: key, currentValue: '(removed)' });
    }
  }
  for (const key of currentKpiKeys) {
    if (!snapshotKpiKeys.has(key)) {
      drifts.push({ field: `kpis`, snapshotValue: '(absent)', currentValue: key });
    }
  }

  // Assumption key sets
  const snapshotAssKeys = new Set(snapshot.assumptions.map((a) => a.assumptionKey));
  const currentAssKeys = new Set(current.assumptions.map((a) => a.assumptionKey));

  for (const key of snapshotAssKeys) {
    if (!currentAssKeys.has(key)) {
      drifts.push({ field: `assumptions`, snapshotValue: key, currentValue: '(removed)' });
    }
  }
  for (const key of currentAssKeys) {
    if (!snapshotAssKeys.has(key)) {
      drifts.push({ field: `assumptions`, snapshotValue: '(absent)', currentValue: key });
    }
  }

  // Check individual KPI confidence changes (material for CFO-grade reproducibility)
  const currentKpiMap = new Map(current.kpis.map((k) => [k.kpiKey, k]));
  for (const snapshotKpi of snapshot.kpis) {
    const currentKpi = currentKpiMap.get(snapshotKpi.kpiKey);
    if (currentKpi && snapshotKpi.defaultConfidence !== currentKpi.defaultConfidence) {
      drifts.push({
        field: `kpis[${snapshotKpi.kpiKey}].defaultConfidence`,
        snapshotValue: String(snapshotKpi.defaultConfidence),
        currentValue: String(currentKpi.defaultConfidence),
      });
    }
  }

  return drifts;
}
