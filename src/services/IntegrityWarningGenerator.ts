/**
 * Integrity Warning Generator
 * 
 * Generates SDUI components for Manifesto rule violations and warnings.
 */

import { logger } from '../lib/logger';
import { ManifestoCheckResult } from '../types/sdui-integration';
import {
  AtomicUIAction,
  createAddAction,
  createMutateAction,
} from '../sdui/AtomicUIActions';

/**
 * Integrity Warning Generator
 */
export class IntegrityWarningGenerator {
  /**
   * Generate SDUI actions for Manifesto check result
   */
  generateWarningActions(
    result: ManifestoCheckResult,
    workspaceId: string
  ): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Generate actions for violations
    if (result.violations.length > 0) {
      actions.push(...this.generateViolationActions(result.violations, workspaceId));
    }

    // Generate actions for warnings
    if (result.warnings.length > 0) {
      actions.push(...this.generateWarningBanners(result.warnings, workspaceId));
    }

    logger.info('Generated integrity warning actions', {
      workspaceId,
      violationCount: result.violations.length,
      warningCount: result.warnings.length,
      actionCount: actions.length,
    });

    return actions;
  }

  /**
   * Generate actions for violations
   */
  private generateViolationActions(
    violations: any[],
    workspaceId: string
  ): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Add IntegrityReviewPanel if violations exist
    actions.push(
      createAddAction(
        {
          component: 'IntegrityReviewPanel',
          props: {
            violations: violations.map((v) => ({
              rule: v.rule,
              severity: v.severity,
              message: v.message,
              context: v.context,
            })),
            workspaceId,
            showOverrideButton: true,
          },
        },
        { position: 'top', append: false },
        'Show integrity violations'
      )
    );

    // Add alert banner
    actions.push(
      createAddAction(
        {
          component: 'Alert',
          props: {
            variant: 'error',
            title: 'Manifesto Rule Violations',
            message: `${violations.length} violation(s) detected. Review required before proceeding.`,
            dismissible: false,
            actions: [
              {
                label: 'Review Violations',
                action: 'openIntegrityPanel',
              },
            ],
          },
        },
        { position: 'top', append: false },
        'Show violation alert'
      )
    );

    return actions;
  }

  /**
   * Generate warning banners
   */
  private generateWarningBanners(
    warnings: any[],
    workspaceId: string
  ): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Group warnings by severity
    const highPriorityWarnings = warnings.filter((w) =>
      w.rule.startsWith('RULE_001') || w.rule.startsWith('RULE_002')
    );

    if (highPriorityWarnings.length > 0) {
      actions.push(
        createAddAction(
          {
            component: 'Alert',
            props: {
              variant: 'warning',
              title: 'Manifesto Recommendations',
              message: highPriorityWarnings.map((w) => w.message).join('; '),
              dismissible: true,
              actions: [
                {
                  label: 'View Suggestions',
                  action: 'showSuggestions',
                },
              ],
            },
          },
          { position: 'top', append: true },
          'Show high-priority warnings'
        )
      );
    }

    // Add info banner for other warnings
    const otherWarnings = warnings.filter((w) =>
      !w.rule.startsWith('RULE_001') && !w.rule.startsWith('RULE_002')
    );

    if (otherWarnings.length > 0) {
      actions.push(
        createAddAction(
          {
            component: 'InfoBanner',
            props: {
              title: 'Suggestions',
              description: `${otherWarnings.length} suggestion(s) to improve artifact quality`,
              tone: 'info',
              dismissible: true,
            },
          },
          { position: 'bottom', append: true },
          'Show suggestions banner'
        )
      );
    }

    return actions;
  }

  /**
   * Generate IntegrityReviewPanel component
   */
  generateIntegrityPanel(
    result: ManifestoCheckResult,
    workspaceId: string,
    actionId: string
  ): AtomicUIAction {
    return createAddAction(
      {
        component: 'IntegrityReviewPanel',
        props: {
          violations: result.violations,
          warnings: result.warnings,
          workspaceId,
          actionId,
          showOverrideButton: result.violations.length > 0,
          onOverrideRequest: {
            action: 'requestOverride',
            params: { actionId, workspaceId },
          },
        },
      },
      { position: 'modal', append: false },
      'Show integrity review panel'
    );
  }

  /**
   * Generate override request UI
   */
  generateOverrideRequestUI(
    requestId: string,
    violations: any[]
  ): AtomicUIAction {
    return createAddAction(
      {
        component: 'OverrideRequestForm',
        props: {
          requestId,
          violations,
          fields: [
            {
              name: 'justification',
              label: 'Justification',
              type: 'textarea',
              required: true,
              placeholder: 'Explain why this override is necessary...',
            },
          ],
          onSubmit: {
            action: 'submitOverrideRequest',
            params: { requestId },
          },
        },
      },
      { position: 'modal', append: false },
      'Show override request form'
    );
  }

  /**
   * Clear integrity warnings
   */
  clearWarnings(workspaceId: string): AtomicUIAction[] {
    return [
      {
        type: 'remove_component',
        target: { type: 'IntegrityReviewPanel', props: { workspaceId } },
        reason: 'Clear integrity warnings',
      },
      {
        type: 'remove_component',
        target: { type: 'Alert', props: { variant: 'error' } },
        reason: 'Clear violation alerts',
      },
      {
        type: 'remove_component',
        target: { type: 'Alert', props: { variant: 'warning' } },
        reason: 'Clear warning alerts',
      },
    ];
  }
}

// Singleton instance
export const integrityWarningGenerator = new IntegrityWarningGenerator();
