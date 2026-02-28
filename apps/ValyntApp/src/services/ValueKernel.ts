import { v4 as uuidv4 } from 'uuid';

import {
  assertEntryPointAccess,
  EntryPoint,
  IntentBinding,
  KernelIntent,
} from '../config/entrypoints';
import { logger } from '../lib/logger';
import { LifecycleStage } from '../types/workflow';

import { Permission } from './PermissionService';


export type CanonicalKernelEventType =
  | 'ExecutionStarted'
  | 'StageCompleted'
  | 'ValueUpdated'
  | 'AssumptionChanged';

export interface KernelEventMetadata {
  entryPoint: EntryPoint;
  intent: KernelIntent;
  stage?: LifecycleStage;
  userId?: string;
  workspaceId?: string;
  audit: {
    id: string;
    entryPoint: EntryPoint;
    intent: KernelIntent;
    requiredPermissions: Permission[];
    allowedStages: LifecycleStage[];
  };
  context?: Record<string, unknown>;
}

export interface KernelEvent {
  id: string;
  sequence: number;
  type: CanonicalKernelEventType;
  occurredAt: string;
  metadata: KernelEventMetadata;
  payload?: Record<string, unknown>;
}

export interface KernelInvocationContext {
  entryPoint: EntryPoint;
  intent: KernelIntent;
  permissions: Permission[];
  stage?: LifecycleStage;
  userId?: string;
  workspaceId?: string;
  context?: Record<string, unknown>;
}

export class ValueKernel {
  private sequence = 0;
  private events: KernelEvent[] = [];
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
  }

  startExecution(invocation: KernelInvocationContext & { correlationId?: string }): KernelEvent {
    return this.emitEvent('ExecutionStarted', invocation, {
      correlationId: invocation.correlationId,
    });
  }

  completeStage(
    invocation: KernelInvocationContext & { result?: Record<string, unknown> }
  ): KernelEvent {
    return this.emitEvent('StageCompleted', invocation, { result: invocation.result });
  }

  valueUpdated(
    invocation: KernelInvocationContext & { changeSet: Record<string, unknown> }
  ): KernelEvent {
    return this.emitEvent('ValueUpdated', invocation, {
      changeSet: invocation.changeSet,
    });
  }

  assumptionChanged(
    invocation: KernelInvocationContext & { assumptionId: string; updates: Record<string, unknown> }
  ): KernelEvent {
    return this.emitEvent('AssumptionChanged', invocation, {
      assumptionId: invocation.assumptionId,
      updates: invocation.updates,
    });
  }

  getEventStream(): KernelEvent[] {
    return [...this.events];
  }

  private emitEvent(
    type: CanonicalKernelEventType,
    invocation: KernelInvocationContext,
    payload?: Record<string, unknown>
  ): KernelEvent {
    const binding: IntentBinding = assertEntryPointAccess({
      entryPoint: invocation.entryPoint,
      intent: invocation.intent,
      permissions: invocation.permissions,
      stage: invocation.stage,
    });

    const event: KernelEvent = {
      id: uuidv4(),
      sequence: ++this.sequence,
      type,
      occurredAt: this.clock(),
      metadata: {
        entryPoint: invocation.entryPoint,
        intent: invocation.intent,
        stage: invocation.stage,
        userId: invocation.userId,
        workspaceId: invocation.workspaceId,
        audit: {
          id: uuidv4(),
          entryPoint: invocation.entryPoint,
          intent: invocation.intent,
          requiredPermissions: binding.requiredPermissions,
          allowedStages: binding.allowedStages,
        },
        context: invocation.context,
      },
      payload,
    };

    this.events.push(event);

    logger.info('Kernel event emitted', {
      type,
      sequence: event.sequence,
      entryPoint: invocation.entryPoint,
      intent: invocation.intent,
      stage: invocation.stage,
    });

    return event;
  }
}
