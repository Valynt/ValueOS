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

type RuntimeStage = 'dev' | 'staging' | 'prod';

type GovernanceFallbackWarning = {
  envVar: string;
  reason: 'missing_or_empty';
  fallbackValue: string;
};

function resolveRuntimeStage(env: NodeJS.ProcessEnv): RuntimeStage {
  const nodeEnv = (env.NODE_ENV ?? '').toLowerCase();
  const runtimeStage = (env.RUNTIME_STAGE ?? env.STAGE ?? '').toLowerCase();
  if (runtimeStage === 'prod' || runtimeStage === 'production' || nodeEnv === 'production') {
    return 'prod';
  }
  if (runtimeStage === 'staging') {
    return 'staging';
  }
  return 'dev';
}

function isStrictProductionMode(env: NodeJS.ProcessEnv): boolean {
  return resolveRuntimeStage(env) === 'prod';
}

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
  const parsed = stageRequiredFieldsSchema.parse(JSON.parse(raw ?? ''));
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

function buildNonProdFallbackWarnings(parsed: z.infer<typeof governanceEnvSchema>): GovernanceFallbackWarning[] {
  const warnings: GovernanceFallbackWarning[] = [];
  if (!parsed.GOVERNANCE_STAGE_REQUIRED_FIELDS?.trim()) {
    warnings.push({
      envVar: 'GOVERNANCE_STAGE_REQUIRED_FIELDS',
      reason: 'missing_or_empty',
      fallbackValue: JSON.stringify(DEFAULT_STAGE_REQUIRED_FIELDS),
    });
  }
  return warnings;
}

export function loadGovernanceConfig(env: NodeJS.ProcessEnv = process.env): GovernanceConfig {
  const parsed = governanceEnvSchema.parse(env);
  const strictMode = isStrictProductionMode(env);

  if (!strictMode) {
    for (const warning of buildNonProdFallbackWarnings(parsed)) {
      logger.warn('governance.config.fallback_applied', {
        event: 'governance_config_fallback',
        envVar: warning.envVar,
        reason: warning.reason,
        runtimeStage: resolveRuntimeStage(env),
        fallbackValue: warning.fallbackValue,
        metric: {
          name: 'governance.config.fallback_applied',
          value: 1,
          labels: { envVar: warning.envVar, runtimeStage: resolveRuntimeStage(env) },
        },
      });
    }
  }

  return {
    permissionCacheTtlMs: parsed.GOVERNANCE_PERMISSION_CACHE_TTL_MS,
    permissionCacheMax: parsed.GOVERNANCE_PERMISSION_CACHE_MAX,
    destructiveActions: parseCsv(parsed.GOVERNANCE_DESTRUCTIVE_ACTIONS, DEFAULT_DESTRUCTIVE_ACTIONS),
    elevatedRoles: parseCsv(parsed.GOVERNANCE_ELEVATED_ROLES, DEFAULT_ELEVATED_ROLES),
    prodApprovalRequiredActions: parseCsv(
      parsed.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS,
      DEFAULT_PROD_APPROVAL_REQUIRED_ACTIONS,
    ),
    stageRequiredFields: parsed.GOVERNANCE_STAGE_REQUIRED_FIELDS?.trim()
      ? parseStageRequiredFields(parsed.GOVERNANCE_STAGE_REQUIRED_FIELDS)
      : {
          dev: [...DEFAULT_STAGE_REQUIRED_FIELDS.dev],
          staging: [...DEFAULT_STAGE_REQUIRED_FIELDS.staging],
          prod: [...DEFAULT_STAGE_REQUIRED_FIELDS.prod],
        },
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

  const strictMode = isStrictProductionMode(env);
  const stageValue = parsed.data.GOVERNANCE_STAGE_REQUIRED_FIELDS;

  if (!stageValue || stageValue.trim().length === 0) {
    if (strictMode) {
      return ['Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS: required in production/prod runtime stage'];
    }
    return [];
  }

  let jsonValue: unknown;
  try {
    jsonValue = JSON.parse(stageValue);
  } catch {
    return ['Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS: malformed JSON'];
  }

  const stageParsed = stageRequiredFieldsSchema.safeParse(jsonValue);
  if (stageParsed.success) {
    return [];
  }

  return stageParsed.error.issues.map((issue) => {
    const key = issue.path.join('.') || 'governance';
    return `Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS.${key}: ${issue.message}`;
  });
}
