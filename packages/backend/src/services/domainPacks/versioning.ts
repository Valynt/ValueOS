/**
 * Domain Pack Versioning
 *
 * Pure functions for semver version management and publish-readiness checks.
 */

import type {
  DomainPack,
  DomainPackAssumption,
  DomainPackKpi,
  PackStatus,
} from '../../api/domainPacks/types.js';

// ============================================================================
// Semver Helpers
// ============================================================================

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a semver string into its numeric parts.
 * Returns null if the string is not valid semver.
 */
export function parseSemver(version: string): SemverParts | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Format SemverParts back to a string.
 */
export function formatSemver(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/**
 * Bump the patch version: 1.2.3 -> 1.2.4
 */
export function nextPatch(current: string): string {
  const parts = parseSemver(current);
  if (!parts) throw new Error(`Invalid semver: ${current}`);
  return formatSemver({ ...parts, patch: parts.patch + 1 });
}

/**
 * Bump the minor version: 1.2.3 -> 1.3.0
 */
export function nextMinor(current: string): string {
  const parts = parseSemver(current);
  if (!parts) throw new Error(`Invalid semver: ${current}`);
  return formatSemver({ ...parts, minor: parts.minor + 1, patch: 0 });
}

/**
 * Bump the major version: 1.2.3 -> 2.0.0
 */
export function nextMajor(current: string): string {
  const parts = parseSemver(current);
  if (!parts) throw new Error(`Invalid semver: ${current}`);
  return formatSemver({ major: parts.major + 1, minor: 0, patch: 0 });
}

/**
 * Auto-increment: defaults to patch bump.
 */
export function nextVersion(current: string): string {
  return nextPatch(current);
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa) throw new Error(`Invalid semver: ${a}`);
  if (!pb) throw new Error(`Invalid semver: ${b}`);

  for (const field of ['major', 'minor', 'patch'] as const) {
    if (pa[field] < pb[field]) return -1;
    if (pa[field] > pb[field]) return 1;
  }
  return 0;
}

// ============================================================================
// Publish Readiness
// ============================================================================

export interface PublishValidationError {
  field: string;
  message: string;
}

/**
 * Validate that a pack is ready to transition from draft -> active.
 * Returns an empty array if publishable.
 */
export function assertPublishable(pack: {
  name: string;
  industry: string;
  version: string;
  kpis: readonly DomainPackKpi[];
  assumptions: readonly DomainPackAssumption[];
}): PublishValidationError[] {
  const errors: PublishValidationError[] = [];

  if (!pack.name.trim()) {
    errors.push({ field: 'name', message: 'Pack name is required' });
  }

  if (!pack.industry.trim()) {
    errors.push({ field: 'industry', message: 'Industry is required' });
  }

  if (!parseSemver(pack.version)) {
    errors.push({ field: 'version', message: `Invalid semver: ${pack.version}` });
  }

  // At least one KPI required for a publishable pack
  if (pack.kpis.length === 0) {
    errors.push({ field: 'kpis', message: 'At least one KPI is required to publish' });
  }

  // Check for duplicate KPI keys
  const kpiKeys = new Set<string>();
  for (const kpi of pack.kpis) {
    if (kpiKeys.has(kpi.kpiKey)) {
      errors.push({ field: 'kpis', message: `Duplicate KPI key: ${kpi.kpiKey}` });
    }
    kpiKeys.add(kpi.kpiKey);
  }

  // Check for duplicate assumption keys
  const assumptionKeys = new Set<string>();
  for (const assumption of pack.assumptions) {
    if (assumptionKeys.has(assumption.assumptionKey)) {
      errors.push({
        field: 'assumptions',
        message: `Duplicate assumption key: ${assumption.assumptionKey}`,
      });
    }
    assumptionKeys.add(assumption.assumptionKey);
  }

  // Every KPI must have a defaultName
  for (const kpi of pack.kpis) {
    if (!kpi.defaultName.trim()) {
      errors.push({
        field: `kpis[${kpi.kpiKey}].defaultName`,
        message: 'KPI defaultName is required',
      });
    }
  }

  return errors;
}

// ============================================================================
// Governance Checks (pre-enterprise hardening)
// ============================================================================

/**
 * Detect circular parent references in a pack ancestry chain.
 * Takes a lookup function that resolves parentPackId -> pack.
 * Returns the ID where the cycle was detected, or null if no cycle.
 */
export function detectCircularParent(
  packId: string,
  parentPackId: string | null,
  resolveParent: (id: string) => { id: string; parentPackId: string | null } | undefined,
): string | null {
  const visited = new Set<string>([packId]);
  let currentParentId = parentPackId;

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return currentParentId;
    }
    visited.add(currentParentId);

    const parent = resolveParent(currentParentId);
    if (!parent) break;
    currentParentId = parent.parentPackId;
  }

  return null;
}

/**
 * Check that a child pack does not reference a deprecated parent.
 */
export function validateParentNotDeprecated(
  parentStatus: PackStatus | undefined,
): PublishValidationError | null {
  if (parentStatus === 'deprecated') {
    return {
      field: 'parentPackId',
      message: 'Cannot publish a pack whose parent is deprecated',
    };
  }
  return null;
}

/**
 * Check that an active (published) pack is not being edited.
 * Active packs are immutable — create a new version instead.
 */
export function assertMutable(status: PackStatus): PublishValidationError | null {
  if (status === 'active') {
    return {
      field: 'status',
      message: 'Active packs are immutable. Create a new version to make changes.',
    };
  }
  if (status === 'deprecated') {
    return {
      field: 'status',
      message: 'Deprecated packs cannot be edited.',
    };
  }
  return null;
}

/**
 * Check that a new version is strictly greater than the current published version.
 */
export function assertVersionIncreased(
  newVersion: string,
  currentPublishedVersion: string | null,
): PublishValidationError | null {
  if (!currentPublishedVersion) return null;

  const newParts = parseSemver(newVersion);
  const currentParts = parseSemver(currentPublishedVersion);
  if (!newParts || !currentParts) return null;

  if (compareSemver(newVersion, currentPublishedVersion) <= 0) {
    return {
      field: 'version',
      message: `New version ${newVersion} must be greater than current published version ${currentPublishedVersion}`,
    };
  }
  return null;
}

/**
 * Extended publish validation that includes governance checks.
 * Accepts optional context about the parent pack and existing published versions.
 */
export function assertPublishableWithGovernance(
  pack: {
    id: string;
    name: string;
    industry: string;
    version: string;
    status: PackStatus;
    parentPackId: string | null;
    kpis: readonly DomainPackKpi[];
    assumptions: readonly DomainPackAssumption[];
  },
  context?: {
    parentStatus?: PackStatus;
    currentPublishedVersion?: string | null;
    resolveParent?: (id: string) => { id: string; parentPackId: string | null } | undefined;
  },
): PublishValidationError[] {
  // Start with base validation
  const errors = assertPublishable(pack);

  // Pack must be in draft to publish
  if (pack.status !== 'draft') {
    errors.push({
      field: 'status',
      message: `Only draft packs can be published. Current status: ${pack.status}`,
    });
  }

  if (!context) return errors;

  // Parent must not be deprecated
  if (context.parentStatus) {
    const parentErr = validateParentNotDeprecated(context.parentStatus);
    if (parentErr) errors.push(parentErr);
  }

  // Version must be greater than current published version
  if (context.currentPublishedVersion !== undefined) {
    const versionErr = assertVersionIncreased(pack.version, context.currentPublishedVersion);
    if (versionErr) errors.push(versionErr);
  }

  // No circular parent references
  if (pack.parentPackId && context.resolveParent) {
    const cycleAt = detectCircularParent(pack.id, pack.parentPackId, context.resolveParent);
    if (cycleAt) {
      errors.push({
        field: 'parentPackId',
        message: `Circular parent reference detected at pack: ${cycleAt}`,
      });
    }
  }

  return errors;
}
