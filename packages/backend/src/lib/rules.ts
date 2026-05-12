/**
 * Governance Rules Engine
 *
 * Replaces the former stub that always returned { allowed: true }.
 *
 * enforceRules() is the mandatory policy gate called by ActionRouter before
 * every action execution. It evaluates a GovernanceContext through four
 * ordered layers and returns a structured GovernanceDecision.
 *
 * Fail-closed: any unhandled exception during evaluation produces a deny
 * decision. The engine never returns allowed: true from a catch block.
 *
 * The public enforceRules() signature preserves the existing EnforcementResult
 * shape so ActionRouter requires no call-site changes. The richer
 * GovernanceDecision type is available for callers that need it via
 * enforceRulesDetailed().
 */

// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from './supabase.js';
import { logger } from './logger.js';
import { loadGovernanceConfig } from '../config/governance.js';
import { evaluateGovernanceDrift, type DriftAssessment } from './governance/driftPrimitives.js';
import { createCounter } from './observability/index.js';

// ---------------------------------------------------------------------------
// Permission cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
  authVersion: string;
}

// Simple in-process LRU-style cache: max 2000 entries, 30 s TTL.
// Avoids a hard dependency on an external cache library while still
// eliminating the majority of repeated DB round-trips on the hot path.
const governanceConfig = loadGovernanceConfig();

const driftDetectedTotal = createCounter(
  'drift_detected_total',
  'Total detected governance drift events',
  ['drift_type', 'severity', 'remediation_action', 'stage', 'action_name']
);
const driftRemediatedTotal = createCounter(
  'drift_remediated_total',
  'Total governance drift events remediated automatically',
  ['drift_type', 'severity', 'remediation_action', 'stage', 'action_name']
);
const driftUnresolvedTotal = createCounter(
  'drift_unresolved_total',
  'Total governance drift events that remain unresolved',
  ['drift_type', 'severity', 'remediation_action', 'stage', 'action_name']
);
const driftDeniedTotal = createCounter(
  'drift_denied_total',
  'Total governance drift events resulting in denied decisions',
  ['drift_type', 'severity', 'remediation_action', 'stage', 'action_name']
);

interface DriftTelemetryContext {
  stage: GovernanceContext['environment']['stage'];
  actionName: string;
  tenantId?: string;
  sessionId?: string;
}

function emitDriftTelemetry(assessment: DriftAssessment, ctx: DriftTelemetryContext, outcome: 'detected' | 'remediated' | 'unresolved' | 'denied'): void {
  const labels = {
    drift_type: assessment.driftType ?? 'UNKNOWN',
    severity: assessment.severity ?? 'unknown',
    remediation_action: assessment.remediationAction ?? 'NONE',
    stage: ctx.stage,
    action_name: ctx.actionName,
  };

  driftDetectedTotal.inc(labels);
  if (outcome === 'remediated') driftRemediatedTotal.inc(labels);
  if (outcome === 'unresolved') driftUnresolvedTotal.inc(labels);
  if (outcome === 'denied') driftDeniedTotal.inc(labels);

  logger.warn('governance.drift.telemetry', {
    outcome,
    driftType: assessment.driftType ?? 'UNKNOWN',
    severity: assessment.severity ?? 'unknown',
    remediationAction: assessment.remediationAction ?? 'NONE',
    stage: ctx.stage,
    actionName: ctx.actionName,
    sessionId: ctx.sessionId ?? 'unknown',
    requestId: ctx.sessionId ?? 'unknown',
    ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
  });
}

const PERMISSION_CACHE_TTL_MS = governanceConfig.permissionCacheTtlMs;
const PERMISSION_CACHE_MAX = governanceConfig.permissionCacheMax;
const permissionCache = new Map<string, CacheEntry>();

export function __resetPermissionCacheForTests(): void {
  permissionCache.clear();
}

export function invalidatePermissionCache(userId: string, tenantId: string): void {
  const keyPrefix = `${tenantId}:${userId}:`;
  for (const key of permissionCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      permissionCache.delete(key);
    }
  }
}

function buildPermissionCacheKey(userId: string, tenantId: string, authVersion: string): string {
  return `${tenantId}:${userId}:${authVersion}`;
}

function getCachedPermissions(
  userId: string,
  tenantId: string,
  authVersion: string,
  requestId?: string
): string[] | null {
  const key = buildPermissionCacheKey(userId, tenantId, authVersion);
  const entry = permissionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    permissionCache.delete(key);
    return null;
  }
  logger.info('governance.permission_cache', {
    outcome: 'hit',
    userId,
    tenantId,
    authVersion,
    requestId: requestId ?? 'unknown',
  });
  return entry.permissions;
}

function setCachedPermissions(
  userId: string,
  tenantId: string,
  authVersion: string,
  permissions: string[]
): void {
  const key = buildPermissionCacheKey(userId, tenantId, authVersion);
  // Evict oldest entry when at capacity (Map preserves insertion order).
  if (permissionCache.size >= PERMISSION_CACHE_MAX) {
    const firstKey = permissionCache.keys().next().value;
    if (firstKey !== undefined) permissionCache.delete(firstKey);
  }
  permissionCache.set(key, {
    permissions,
    authVersion,
    expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
  });
}

// ============================================================================
// Governance Types
// ============================================================================

export type GovernanceReasonCode =
  | 'ALLOW'
  | 'DENY_UNAUTHENTICATED'
  | 'DENY_UNAUTHORIZED'
  | 'DENY_CROSS_TENANT'
  | 'DENY_POLICY'
  | 'DENY_RISK'
  | 'DENY_MISSING_APPROVAL'
  | 'DENY_INVALID_STATE';

export type GovernanceObligation =
  | { type: 'REDACT_FIELDS'; fields: string[] }
  | { type: 'REQUIRE_APPROVAL'; approvalType: string }
  | { type: 'READ_ONLY' }
  | { type: 'LOG_AUDIT' };

export interface GovernanceAudit {
  policyVersion: string;
  evaluatedAt: string;
  matchedRules: string[];
}


export interface GovernanceDecision {
  allowed: boolean;
  reasonCode: GovernanceReasonCode;
  message: string;
  obligations?: GovernanceObligation[];
  audit: GovernanceAudit;
}

export interface GovernanceContext {
  actor: {
    userId: string;
    tenantId: string;
    roles: string[];
    sessionId?: string;
  };
  action: {
    type: string;
    name: string;
    target?: {
      resourceType: string;
      resourceId?: string;
      ownerTenantId?: string;
    };
    payload?: unknown;
  };
  environment: {
    stage: 'dev' | 'staging' | 'prod';
    nowIso: string;
  };
  workflow?: {
    workflowId?: string;
    step?: string;
    approvals?: string[];
  };
}

// ============================================================================
// Legacy types — kept for backward compatibility with ActionRouter
// ============================================================================

export interface Rule {
  id: string;
  name: string;
  condition: (context: Record<string, unknown>) => boolean;
  action: (context: Record<string, unknown>) => void | Promise<void>;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface RuleWarning {
  ruleId: string;
  ruleName: string;
  message: string;
}

export interface EnforcementResult {
  allowed: boolean;
  violations: RuleViolation[];
  warnings: RuleWarning[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Policy constants
// ============================================================================

const POLICY_VERSION = 'v1';

/**
 * Action names that require elevated roles (admin/owner) to execute.
 * Destructive = irreversible data mutations or deletions.
 */
const DESTRUCTIVE_ACTIONS = governanceConfig.destructiveActions;

/** Roles considered elevated for destructive action checks. */
const ELEVATED_ROLES = governanceConfig.elevatedRoles;

/**
 * Actions that require an explicit approval entry in workflow.approvals
 * when running in the prod environment.
 */
const PROD_APPROVAL_REQUIRED_ACTIONS = governanceConfig.prodApprovalRequiredActions;

// ============================================================================
// Internal helpers
// ============================================================================

function deny(
  reasonCode: GovernanceReasonCode,
  message: string,
  evaluatedAt: string,
  matchedRules: string[]
): GovernanceDecision {
  return {
    allowed: false,
    reasonCode,
    message,
    audit: { policyVersion: POLICY_VERSION, evaluatedAt, matchedRules },
  };
}

function allow(
  evaluatedAt: string,
  matchedRules: string[],
  obligations: GovernanceObligation[] = []
): GovernanceDecision {
  return {
    allowed: true,
    reasonCode: 'ALLOW',
    message: 'Action approved.',
    obligations: [{ type: 'LOG_AUDIT' }, ...obligations],
    audit: { policyVersion: POLICY_VERSION, evaluatedAt, matchedRules },
  };
}

function isDestructiveAction(actionName: string): boolean {
  return DESTRUCTIVE_ACTIONS.has(actionName);
}

function hasElevatedRole(roles: string[]): boolean {
  return roles.some((r) => ELEVATED_ROLES.has(r));
}

/**
 * Resolve the full permission set for a user in a tenant.
 *
 * Results are cached in-process for 30 s to avoid repeated DB round-trips on
 * the governance hot path. The cache is keyed on tenantId:userId.
 *
 * Returns an empty array on any DB error (fail-closed: caller will deny).
 * Distinguishes between a DB error and an inactive/missing membership so
 * callers can produce accurate denial reasons.
 */
async function resolvePermissions(
  userId: string,
  tenantId: string,
  requestId?: string
): Promise<string[]> {
  const authVersion = 'v1';
  const cached = getCachedPermissions(userId, tenantId, authVersion, requestId);
  if (cached !== null) return cached;
  logger.info('governance.permission_cache', {
    outcome: 'miss',
    userId,
    tenantId,
    authVersion,
    requestId: requestId ?? 'unknown',
  });

  const supabase = createServerSupabaseClient();

  const [membershipResult, rolesResult, permissionsResult] = await Promise.all([
    supabase
      .from('user_tenants')
      .select('status')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId),
    supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId),
  ]);

  if (membershipResult.error) {
    logger.error('governance: DB error verifying membership — denying (fail-closed)', {
      userId,
      tenantId,
      error: membershipResult.error.message,
      denialReason: 'db_error',
    });
    return [];
  }

  if (!membershipResult.data) {
    logger.warn('governance: membership record not found — denying', {
      userId,
      tenantId,
      denialReason: 'membership_not_found',
    });
    return [];
  }

  if (membershipResult.data.status !== 'active') {
    logger.warn('governance: membership is not active — denying', {
      userId,
      tenantId,
      membershipStatus: membershipResult.data.status,
      denialReason: 'membership_inactive',
    });
    return [];
  }

  if (rolesResult.error) {
    logger.error('governance: DB error fetching user roles — denying (fail-closed)', {
      userId,
      tenantId,
      error: rolesResult.error.message,
      denialReason: 'db_error',
    });
    return [];
  }

  if (permissionsResult.error) {
    logger.error('governance: DB error fetching user permissions — denying (fail-closed)', {
      userId,
      tenantId,
      error: permissionsResult.error.message,
      denialReason: 'db_error',
    });
    return [];
  }

  // Expand system roles into their permission sets using the shared role map.
  // Dynamic import avoids a circular dependency with middleware/rbac.
  const { USER_ROLE_PERMISSIONS } = await import('@shared/lib/permissions');
  const granted: string[] = [];

  for (const row of rolesResult.data ?? []) {
    const rolePerms = USER_ROLE_PERMISSIONS[row.role as keyof typeof USER_ROLE_PERMISSIONS];
    if (rolePerms) {
      granted.push(...(rolePerms as string[]));
    }
  }

  // Append explicit per-user grants.
  for (const row of permissionsResult.data ?? []) {
    if (row.permission) granted.push(row.permission as string);
  }

  setCachedPermissions(userId, tenantId, authVersion, granted);
  return granted;
}

/**
 * Fetch proposal governance state for proposal.publish checks.
 * Returns null when the resource is not found or the query fails.
 */
async function getProposalGovernanceStatus(
  resourceId: string,
  tenantId: string
): Promise<{ integrityPassed: boolean; hasRequiredEvidence: boolean } | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('value_cases')
    .select('integrity_status, evidence_count, required_evidence_count')
    .eq('id', resourceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    logger.warn('governance: failed to fetch proposal governance status', {
      resourceId,
      tenantId,
      error: error?.message,
    });
    return null;
  }

  return {
    integrityPassed: data.integrity_status === 'passed',
    hasRequiredEvidence:
      typeof data.evidence_count === 'number' &&
      typeof data.required_evidence_count === 'number' &&
      data.evidence_count >= data.required_evidence_count,
  };
}

// ============================================================================
// Core evaluation engine
// ============================================================================

/**
 * Evaluate a GovernanceContext through the policy layers and return a
 * structured GovernanceDecision.
 *
 * Evaluation order:
 *   Layer 1 — Hard guards (synchronous, no I/O)
 *   Layer 2 — RBAC (async, reads permissions from DB)
 *   Layer 3 — Workflow-state validation (async, reads case/proposal state)
 *   Layer 4 — Environment controls
 *   Layer 5 — Allow with obligations
 *
 * Fail-closed: any thrown exception returns a deny decision.
 */
export async function enforceRulesDetailed(
  ctx: GovernanceContext
): Promise<GovernanceDecision> {
  const evaluatedAt = new Date().toISOString();
  const matchedRules: string[] = [];

  try {
    // ------------------------------------------------------------------
    // Layer 1: Hard guards — synchronous, no I/O
    // ------------------------------------------------------------------

    if (!ctx.actor?.userId) {
      return deny('DENY_UNAUTHENTICATED', 'User is not authenticated.', evaluatedAt, [
        'auth-required',
      ]);
    }
    matchedRules.push('auth-required');

    if (!ctx.actor?.tenantId) {
      return deny('DENY_POLICY', 'Tenant context is missing.', evaluatedAt, ['tenant-required']);
    }
    matchedRules.push('tenant-required');

    if (
      ctx.action.target?.ownerTenantId &&
      ctx.action.target.ownerTenantId !== ctx.actor.tenantId
    ) {
      return deny(
        'DENY_CROSS_TENANT',
        'Cross-tenant access is not permitted.',
        evaluatedAt,
        ['tenant-isolation']
      );
    }
    matchedRules.push('tenant-isolation');

    // ------------------------------------------------------------------
    // Layer 2: RBAC — resolve permissions and check action authorization
    // ------------------------------------------------------------------

    const highRiskAction =
      ctx.action.name === 'proposal.publish' || isDestructiveAction(ctx.action.name);
    if (highRiskAction) {
      invalidatePermissionCache(ctx.actor.userId, ctx.actor.tenantId);
      logger.info('governance.permission_cache', {
        outcome: 'bypass',
        userId: ctx.actor.userId,
        tenantId: ctx.actor.tenantId,
        action: ctx.action.name,
        requestId: ctx.actor.sessionId ?? 'unknown',
      });
    }

    const granted = await resolvePermissions(
      ctx.actor.userId,
      ctx.actor.tenantId,
      ctx.actor.sessionId
    );

    if (granted.length === 0) {
      // resolvePermissions returns [] on inactive membership or DB error — deny.
      return deny(
        'DENY_UNAUTHORIZED',
        'Actor has no active permissions in this tenant.',
        evaluatedAt,
        ['rbac', 'membership-active']
      );
    }
    matchedRules.push('membership-active');

    // Check that the actor holds the specific permission for this action.
    // Action names use dot notation (e.g. "proposal.publish") or colon notation
    // (e.g. "value_trees:edit"). Both are checked against the granted set.
    const actionPermission = ctx.action.name;
    const hasActionPermission = granted.some(
      (g) => g === actionPermission || g === `${actionPermission}:*` || g === '*:*'
    );

    if (!hasActionPermission) {
      logger.warn('governance: RBAC deny', {
        userId: ctx.actor.userId,
        tenantId: ctx.actor.tenantId,
        action: ctx.action.name,
      });
      return deny(
        'DENY_UNAUTHORIZED',
        `Actor lacks permission for action: ${ctx.action.name}`,
        evaluatedAt,
        ['rbac']
      );
    }
    matchedRules.push('rbac');

    // Destructive actions require an elevated role regardless of explicit grants.
    if (isDestructiveAction(ctx.action.name)) {
      if (!hasElevatedRole(ctx.actor.roles)) {
        return deny(
          'DENY_UNAUTHORIZED',
          'Elevated privileges required for destructive actions.',
          evaluatedAt,
          ['destructive-action-guard']
        );
      }
      matchedRules.push('destructive-action-guard');
    }

    // ------------------------------------------------------------------
    // Layer 3: Workflow-state validation
    // ------------------------------------------------------------------

    if (ctx.action.name === 'proposal.publish') {
      const resourceId = ctx.action.target?.resourceId;
      if (!resourceId) {
        return deny(
          'DENY_INVALID_STATE',
          'proposal.publish requires a target resourceId.',
          evaluatedAt,
          ['proposal-integrity']
        );
      }

      const status = await getProposalGovernanceStatus(resourceId, ctx.actor.tenantId);
      if (!status) {
        return deny(
          'DENY_INVALID_STATE',
          'Proposal not found or governance state unavailable.',
          evaluatedAt,
          ['proposal-integrity']
        );
      }

      if (!status.integrityPassed) {
        return deny(
          'DENY_INVALID_STATE',
          'Proposal cannot be published before integrity review passes.',
          evaluatedAt,
          ['proposal-integrity']
        );
      }

      if (!status.hasRequiredEvidence) {
        return deny(
          'DENY_MISSING_APPROVAL',
          'Required evidence threshold is not met.',
          evaluatedAt,
          ['evidence-threshold']
        );
      }

      matchedRules.push('proposal-integrity', 'evidence-threshold');
    }

    // ------------------------------------------------------------------
    // Layer 4: Environment controls
    // ------------------------------------------------------------------

    if (
      ctx.environment.stage === 'prod' &&
      PROD_APPROVAL_REQUIRED_ACTIONS.has(ctx.action.name)
    ) {
      const approvals = ctx.workflow?.approvals ?? [];
      if (!approvals.includes(ctx.action.name)) {
        return deny(
          'DENY_MISSING_APPROVAL',
          `Action "${ctx.action.name}" requires an explicit approval in production.`,
          evaluatedAt,
          ['prod-approval-required']
        );
      }
      matchedRules.push('prod-approval-required');
    }

    // ------------------------------------------------------------------
    // Layer 5: Allow with obligations
    // ------------------------------------------------------------------
    matchedRules.push('layer5-allow-precheck');

    // ------------------------------------------------------------------
    // Layer 6: Drift checks
    // ------------------------------------------------------------------
    const driftAssessments = evaluateGovernanceDrift(ctx, granted, PROD_APPROVAL_REQUIRED_ACTIONS);
    const detectedDrift = driftAssessments.filter((assessment) => assessment.driftDetected);

    if (detectedDrift.length > 0) {
      matchedRules.push('layer6-drift-check');

      const telemetryContext: DriftTelemetryContext = {
        stage: ctx.environment.stage,
        actionName: ctx.action.name,
        tenantId: ctx.actor.tenantId,
        sessionId: ctx.actor.sessionId,
      };

      const highSeverityDrift = detectedDrift.find((d) => d.severity === 'high');
      if (highSeverityDrift) {
        emitDriftTelemetry(highSeverityDrift, telemetryContext, 'denied');
        return deny(
          'DENY_POLICY',
          highSeverityDrift.details ?? 'Governance drift detected at high severity.',
          evaluatedAt,
          matchedRules
        );
      }

      const obligations: GovernanceObligation[] = [];
      if (detectedDrift.some((d) => d.remediationAction === 'REQUIRE_APPROVAL')) {
        obligations.push({ type: 'REQUIRE_APPROVAL', approvalType: 'drift-remediation' });
      }
      if (detectedDrift.some((d) => d.remediationAction === 'READ_ONLY')) {
        obligations.push({ type: 'READ_ONLY' });
      }

      for (const drift of detectedDrift) {
        const outcome = drift.remediationAction === 'REFRESH_PERMISSIONS' ? 'remediated' : 'unresolved';
        emitDriftTelemetry(drift, telemetryContext, outcome);
      }

      return allow(evaluatedAt, matchedRules, obligations);
    }

    return allow(evaluatedAt, matchedRules);
  } catch (err) {
    logger.error('governance: evaluation threw unexpectedly — failing closed', {
      userId: ctx.actor?.userId,
      tenantId: ctx.actor?.tenantId,
      action: ctx.action?.name,
      error: err instanceof Error ? err.message : String(err),
    });

    // Fail-closed: never return allowed: true from a catch block.
    return deny(
      'DENY_POLICY',
      'Governance evaluation failed.',
      new Date().toISOString(),
      ['governance-evaluation-error']
    );
  }
}

// ============================================================================
// Public API — preserves EnforcementResult shape for ActionRouter
// ============================================================================

/**
 * Evaluate governance rules for an action context.
 *
 * Accepts the legacy Record<string, unknown> shape that ActionRouter passes.
 * Extracts a GovernanceContext from it and delegates to enforceRulesDetailed().
 * Returns an EnforcementResult for backward compatibility with ActionRouter.
 *
 * ActionRouter callers that need the richer GovernanceDecision should call
 * enforceRulesDetailed() directly with a typed GovernanceContext.
 */
export async function enforceRules(
  context: Record<string, unknown>,
  _ruleIds?: string[]
): Promise<EnforcementResult> {
  const stage = resolveStage(context.environment as string | undefined);

  const ctx: GovernanceContext = {
    actor: {
      userId: (context.userId as string) ?? '',
      tenantId: (context.tenantId as string) ?? '',
      roles: Array.isArray(context.roles) ? (context.roles as string[]) : [],
      sessionId: context.sessionId as string | undefined,
    },
    action: {
      type: (context.action as string) ?? (context.actionType as string) ?? '',
      name: (context.action as string) ?? (context.actionType as string) ?? '',
      target: context.targetResourceId
        ? {
            resourceType: (context.targetResourceType as string) ?? 'unknown',
            resourceId: context.targetResourceId as string,
            ownerTenantId: context.ownerTenantId as string | undefined,
          }
        : undefined,
      payload: context.payload,
    },
    environment: {
      stage,
      nowIso: new Date().toISOString(),
    },
    workflow: context.workflowId
      ? {
          workflowId: context.workflowId as string,
          step: context.workflowStep as string | undefined,
          approvals: Array.isArray(context.approvals)
            ? (context.approvals as string[])
            : [],
        }
      : undefined,
  };

  const decision = await enforceRulesDetailed(ctx);

  if (decision.allowed) {
    return {
      allowed: true,
      violations: [],
      warnings: [],
      metadata: {
        reasonCode: decision.reasonCode,
        matchedRules: decision.audit.matchedRules,
        policyVersion: decision.audit.policyVersion,
        evaluatedAt: decision.audit.evaluatedAt,
        obligations: decision.obligations ?? [],
      },
    };
  }

  return {
    allowed: false,
    violations: [
      {
        ruleId: decision.audit.matchedRules[decision.audit.matchedRules.length - 1] ?? 'policy',
        ruleName: decision.reasonCode,
        message: decision.message,
        severity: decision.reasonCode === 'DENY_UNAUTHENTICATED' ? 'error' : 'critical',
      },
    ],
    warnings: [],
    metadata: {
      reasonCode: decision.reasonCode,
      matchedRules: decision.audit.matchedRules,
      policyVersion: decision.audit.policyVersion,
      evaluatedAt: decision.audit.evaluatedAt,
    },
  };
}

function resolveStage(env: string | undefined): 'dev' | 'staging' | 'prod' {
  if (env === 'production' || env === 'prod') return 'prod';
  if (env === 'staging') return 'staging';
  return 'dev';
}

// ============================================================================
// RulesEngine — kept for any callers that use the class-based API
// ============================================================================

export class RulesEngine {
  private rules: Map<string, Rule> = new Map();

  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  async evaluate(context: Record<string, unknown>): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.condition(context)) {
        await rule.action(context);
      }
    }
  }
}
