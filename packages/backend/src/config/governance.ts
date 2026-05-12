import { z } from "zod";

const DEFAULT_DESTRUCTIVE_ACTIONS = [
  'value_model.delete',
  'case.delete',
  'tenant.delete',
  'user.delete',
  'artifact.delete',
  'commitment.delete',
  'value_tree.delete',
  'integration.delete',
  'api_key.delete',
] as const;

const DEFAULT_ELEVATED_ROLES = ['admin', 'owner'] as const;
const DEFAULT_PROD_APPROVAL_REQUIRED_ACTIONS = [
  'proposal.publish',
  'value_model.finalize',
  'commitment.publish',
] as const;

const governanceEnvSchema = z.object({
  GOVERNANCE_PERMISSION_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  GOVERNANCE_PERMISSION_CACHE_MAX: z.coerce.number().int().min(1).max(10_000).default(2_000),
  GOVERNANCE_DESTRUCTIVE_ACTIONS: z.string().optional(),
  GOVERNANCE_ELEVATED_ROLES: z.string().optional(),
  GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: z.string().optional(),
});

export type GovernanceConfig = {
  permissionCacheTtlMs: number;
  permissionCacheMax: number;
  destructiveActions: Set<string>;
  elevatedRoles: Set<string>;
  prodApprovalRequiredActions: Set<string>;
};

function parseCsv(raw: string | undefined, fallback: readonly string[]): Set<string> {
  if (!raw || raw.trim().length === 0) {
    return new Set(fallback);
  }

  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return new Set(parsed.length > 0 ? parsed : fallback);
}

export function loadGovernanceConfig(env: NodeJS.ProcessEnv = process.env): GovernanceConfig {
  const parsed = governanceEnvSchema.parse(env);

  return {
    permissionCacheTtlMs: parsed.GOVERNANCE_PERMISSION_CACHE_TTL_MS,
    permissionCacheMax: parsed.GOVERNANCE_PERMISSION_CACHE_MAX,
    destructiveActions: parseCsv(parsed.GOVERNANCE_DESTRUCTIVE_ACTIONS, DEFAULT_DESTRUCTIVE_ACTIONS),
    elevatedRoles: parseCsv(parsed.GOVERNANCE_ELEVATED_ROLES, DEFAULT_ELEVATED_ROLES),
    prodApprovalRequiredActions: parseCsv(
      parsed.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS,
      DEFAULT_PROD_APPROVAL_REQUIRED_ACTIONS,
    ),
  };
}

export function validateGovernanceConfigEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const parsed = governanceEnvSchema.safeParse(env);
  if (parsed.success) {
    return [];
  }

  return parsed.error.issues.map((issue) => {
    const key = issue.path.join('.') || 'governance';
    return `Invalid ${key}: ${issue.message}`;
  });
}
