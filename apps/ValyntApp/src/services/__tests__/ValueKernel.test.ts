import { describe, expect, it } from 'vitest';

import { entrypointConfig, EntryPointViolationError } from '../../config/entrypoints';
import { ValueKernel } from '../ValueKernel';

const baseContext = {
  entryPoint: 'kernel:value-lifecycle' as const,
  intent: 'execute_workflow' as const,
  permissions: ['user.view', 'audit.view'] as const,
  stage: 'opportunity' as const,
  userId: 'user-123',
  workspaceId: 'workspace-123',
};

describe('ValueKernel', () => {
  it('emits ordered canonical events with audit metadata', () => {
    const kernel = new ValueKernel(() => '2024-01-01T00:00:00.000Z');

    const start = kernel.startExecution({
      ...baseContext,
      context: { correlationId: 'corr-1' },
    });

    const stageCompleted = kernel.completeStage({
      ...baseContext,
      result: { output: 'ok' },
    });

    expect(start.sequence).toBe(1);
    expect(stageCompleted.sequence).toBe(2);
    expect(stageCompleted.metadata.audit.requiredPermissions).toEqual(
      entrypointConfig['kernel:value-lifecycle'].intents.find(
        (intent) => intent.intent === 'execute_workflow'
      )?.requiredPermissions
    );
    expect(stageCompleted.metadata.audit.allowedStages).toContain('opportunity');
    expect(stageCompleted.metadata.audit.id).toBeDefined();
    expect(stageCompleted.occurredAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('rejects disallowed stages with explicit violations', () => {
    const kernel = new ValueKernel();

    expect(() =>
      kernel.valueUpdated({
        entryPoint: 'sdui:action-router',
        intent: 'update_value',
        permissions: ['user.edit', 'audit.view'],
        stage: 'integrity',
        context: { requestId: 'req-1' },
      })
    ).toThrowError(EntryPointViolationError);
  });

  it('rejects missing permissions when emitting events', () => {
    const kernel = new ValueKernel();

    expect(() =>
      kernel.assumptionChanged({
        entryPoint: 'kernel:value-lifecycle',
        intent: 'change_assumption',
        permissions: ['user.view'],
        stage: 'target',
        assumptionId: 'asm-1',
        updates: { value: 0.1 },
      })
    ).toThrowError(EntryPointViolationError);
  });
});
