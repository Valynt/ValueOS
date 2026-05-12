import { z } from "zod";
import { logger } from "../lib/logger.js";

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

const DEFAULT_STAGE_REQUIRED_FIELDS = {
  dev: [],
  staging: ['changeTicketId'],
  prod: ['changeTicketId', 'riskAcceptanceId'],
} as const;

const stageRequiredFieldsSchema = z.object({
  dev: z.array(z.string().min(1)).default([]),
  staging: z.array(z.string().min(1)).min(1),
  prod: z.array(z.string().min(1)).min(1),
});

const governanceEnvSchema = z.object({
  GOVERNANCE_PERMISSION_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  GOVERNANCE_PERMISSION_CACHE_MAX: z.coerce.number().int().min(1).max(10_000).default(2_000),
  GOVERNANCE_DESTRUCTIVE_ACTIONS: z.string().optional(),
  GOVERNANCE_ELEVATED_ROLES: z.string().optional(),
  GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: z.string().optional(),
  GOVERNANCE_STAGE_REQUIRED_FIELDS: z.string().optional(),
});

export type GovernanceConfig = {
  permissionCacheTtlMs: number;
  permissionCacheMax: number;
  destructiveActions: Set<string>;
  elevatedRoles: Set<string>;
  prodApprovalRequiredActions: Set<string>;
  stageRequiredFields: {
    dev: string[];
    staging: string[];
    prod: string[];
  };
};

function parseStageRequiredFields(raw: string | undefined): GovernanceConfig['stageRequiredFields'] {
  if (!raw || raw.trim().length === 0) {
    logger.warn('governance.stage_required_fields.fallback_default', {
      deprecated: true,
      envVar: 'GOVERNANCE_STAGE_REQUIRED_FIELDS',
      message: 'Using hardcoded stage-sensitive required fields. Set GOVERNANCE_STAGE_REQUIRED_FIELDS to remove fallback behavior.',
    });
    return {
      dev: [...DEFAULT_STAGE_REQUIRED_FIELDS.dev],
      staging: [...DEFAULT_STAGE_REQUIRED_FIELDS.staging],
      prod: [...DEFAULT_STAGE_REQUIRED_FIELDS.prod],
    };
  }

  const parsed = stageRequiredFieldsSchema.parse(JSON.parse(raw));
  return {
    dev: parsed.dev,
    staging: parsed.staging,
    prod: parsed.prod,
  };
}

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
    stageRequiredFields: parseStageRequiredFields(parsed.GOVERNANCE_STAGE_REQUIRED_FIELDS),
  };
}

export function validateGovernanceConfigEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const parsed = governanceEnvSchema.safeParse(env);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'governance';
      return `Invalid ${key}: ${issue.message}`;
    });
  }

  const stageValue = parsed.data.GOVERNANCE_STAGE_REQUIRED_FIELDS;
  if (!stageValue || stageValue.trim().length === 0) {
    return [];
  }

  const stageParsed = stageRequiredFieldsSchema.safeParse(
    (() => {
      try {
        return JSON.parse(stageValue);
      } catch {
        return undefined;
      }
    })(),
  );

  if (stageParsed.success) {
    return [];
  }

  return stageParsed.error.issues.map((issue) => {
    const key = issue.path.join('.') || 'governance';
    return `Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS.${key}: ${issue.message}`;
  });
}
