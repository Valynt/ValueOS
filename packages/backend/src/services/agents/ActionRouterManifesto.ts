import {
  ActionContext,
  CanonicalAction,
  ManifestoCheckResult,
} from '@valueos/shared/types/actions';

import { logger } from '../../lib/logger.js';
import { manifestoEnforcer } from '../post-v1/ManifestoEnforcer.js';

export async function checkManifestoRules(
  action: CanonicalAction,
  context: ActionContext
): Promise<ManifestoCheckResult> {
  try {
    const result = await manifestoEnforcer.checkAction(
      action as unknown as Parameters<typeof manifestoEnforcer.checkAction>[0],
      context as unknown as Parameters<typeof manifestoEnforcer.checkAction>[1]
    );

    const rawViolations = result.violations ?? [];
    const rawWarnings = result.warnings ?? [];

    if (rawViolations.length > 0) {
      logger.warn('Manifesto rule violations detected', {
        actionType: action.type,
        violations: rawViolations.map((v) => v.ruleId),
      });
    }

    if (rawWarnings.length > 0) {
      logger.info('Manifesto rule warnings', {
        actionType: action.type,
        warnings: rawWarnings,
      });
    }

    const violations: ManifestoCheckResult['violations'] = rawViolations.map((v) => ({
      ruleId: v.ruleId ?? 'unknown',
      ruleName: v.ruleName ?? 'unknown',
      severity: v.severity as 'error' | 'warning' | 'info',
      message: v.message ?? '',
      path: v.path,
      suggestion: v.suggestion,
    }));

    const warnings: ManifestoCheckResult['warnings'] = rawWarnings.map((w) => ({
      ruleId: 'manifesto-warning',
      ruleName: 'Manifesto Warning',
      severity: 'warning' as const,
      message: typeof w === 'string' ? w : String(w),
    }));

    return { allowed: result.allowed ?? true, violations, warnings };
  } catch (error) {
    logger.error('Failed to check Manifesto rules', {
      actionType: action.type,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      allowed: true,
      violations: [],
      warnings: [
        {
          ruleId: 'SYSTEM',
          ruleName: 'System',
          severity: 'warning',
          message: 'Manifesto rules check failed',
          suggestion: 'Manual review recommended',
        },
      ],
    };
  }
}
