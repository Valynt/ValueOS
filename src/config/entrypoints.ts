import { Permission } from '../services/PermissionService';
import { LifecycleStage } from '../types/workflow';

export type EntryPoint =
  | 'sdui:action-router'
  | 'kernel:value-lifecycle'
  | 'api:workflow-webhook';

export type KernelIntent =
  | 'render_sdui'
  | 'execute_workflow'
  | 'update_value'
  | 'change_assumption';

export interface IntentBinding {
  intent: KernelIntent;
  requiredPermissions: Permission[];
  allowedStages: LifecycleStage[];
  description?: string;
}

export interface EntryPointConfig {
  id: EntryPoint;
  description: string;
  intents: IntentBinding[];
  auditChannel: string;
}

const ALL_STAGES: LifecycleStage[] = [
  'opportunity',
  'target',
  'realization',
  'expansion',
  'integrity',
];

export const entrypointConfig: Record<EntryPoint, EntryPointConfig> = {
  'sdui:action-router': {
    id: 'sdui:action-router',
    description: 'UI entrypoint for SDUI surfaces and action routing',
    auditChannel: 'sdui',
    intents: [
      {
        intent: 'render_sdui',
        requiredPermissions: ['user.view'],
        allowedStages: ALL_STAGES,
        description: 'Render SDUI experiences for the current lifecycle stage',
      },
      {
        intent: 'update_value',
        requiredPermissions: ['user.edit', 'audit.view'],
        allowedStages: ['target', 'realization', 'expansion'],
        description: 'Value tree and KPI mutations sourced from the UI',
      },
      {
        intent: 'change_assumption',
        requiredPermissions: ['user.edit', 'audit.view'],
        allowedStages: ['opportunity', 'target', 'integrity'],
        description: 'Assumption changes initiated from UI components',
      },
    ],
  },
  'kernel:value-lifecycle': {
    id: 'kernel:value-lifecycle',
    description: 'Kernel-managed lifecycle orchestration',
    auditChannel: 'kernel',
    intents: [
      {
        intent: 'execute_workflow',
        requiredPermissions: ['user.view', 'audit.view'],
        allowedStages: ALL_STAGES,
        description: 'Drive lifecycle execution from the kernel',
      },
      {
        intent: 'update_value',
        requiredPermissions: ['user.edit', 'audit.view'],
        allowedStages: ['target', 'realization', 'expansion'],
        description: 'Kernel-side value updates synchronized to storage',
      },
      {
        intent: 'change_assumption',
        requiredPermissions: ['user.edit', 'audit.view'],
        allowedStages: ['opportunity', 'target', 'integrity'],
        description: 'Kernel-side assumption adjustments with safety rails',
      },
    ],
  },
  'api:workflow-webhook': {
    id: 'api:workflow-webhook',
    description: 'Inbound webhooks that can advance lifecycle workflows',
    auditChannel: 'webhook',
    intents: [
      {
        intent: 'execute_workflow',
        requiredPermissions: ['audit.view'],
        allowedStages: ALL_STAGES,
        description: 'Webhook-triggered execution start',
      },
      {
        intent: 'update_value',
        requiredPermissions: ['user.edit', 'audit.view'],
        allowedStages: ['realization', 'expansion'],
        description: 'Webhook-provided value deltas',
      },
    ],
  },
};

export class EntryPointViolationError extends Error {
  constructor(
    message: string,
    public readonly detail: {
      entryPoint: EntryPoint;
      intent: KernelIntent;
      stage?: LifecycleStage;
      providedPermissions?: Permission[];
      requiredPermissions?: Permission[];
      allowedStages?: LifecycleStage[];
      reason: 'intent_not_allowed' | 'permission_denied' | 'stage_not_allowed';
    }
  ) {
    super(message);
    this.name = 'EntryPointViolationError';
  }
}

export function getEntryPointConfig(entryPoint: EntryPoint): EntryPointConfig {
  const config = entrypointConfig[entryPoint];
  if (!config) {
    throw new Error(`Unknown entry point: ${entryPoint}`);
  }
  return config;
}

export function getIntentBinding(entryPoint: EntryPoint, intent: KernelIntent): IntentBinding {
  const config = getEntryPointConfig(entryPoint);
  const binding = config.intents.find((candidate) => candidate.intent === intent);

  if (!binding) {
    throw new EntryPointViolationError(
      `Intent ${intent} is not allowed for entry point ${entryPoint}`,
      {
        entryPoint,
        intent,
        reason: 'intent_not_allowed',
      }
    );
  }

  return binding;
}

export function assertEntryPointAccess({
  entryPoint,
  intent,
  permissions,
  stage,
}: {
  entryPoint: EntryPoint;
  intent: KernelIntent;
  permissions: Permission[];
  stage?: LifecycleStage;
}): IntentBinding {
  const binding = getIntentBinding(entryPoint, intent);

  const missingPermissions = binding.requiredPermissions.filter(
    (required) => !permissions.includes(required)
  );

  if (missingPermissions.length > 0) {
    throw new EntryPointViolationError(
      `Missing required permissions for intent ${intent}: ${missingPermissions.join(', ')}`,
      {
        entryPoint,
        intent,
        providedPermissions: permissions,
        requiredPermissions: binding.requiredPermissions,
        reason: 'permission_denied',
      }
    );
  }

  if (stage && !binding.allowedStages.includes(stage)) {
    throw new EntryPointViolationError(
      `Stage ${stage} is not allowed for intent ${intent} at entry point ${entryPoint}`,
      {
        entryPoint,
        intent,
        stage,
        allowedStages: binding.allowedStages,
        reason: 'stage_not_allowed',
      }
    );
  }

  return binding;
}
