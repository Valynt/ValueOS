import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type { WarmthState } from '@shared/domain/Warmth';
import type { SagaStateEnum } from '@shared/domain/ExperienceModel';

/**
 * Warmth transition event - Fired when a case's warmth state changes
 */
export interface WarmthTransitionEvent {
  type: 'WARMTH_TRANSITION';
  caseId: string;
  previous: {
    state: WarmthState;
    confidence: number;
    sagaState: SagaStateEnum;
  };
  current: {
    state: WarmthState;
    confidence: number;
    sagaState: SagaStateEnum;
  };
  triggeredBy: 'user' | 'agent' | 'system';
  timestamp: string;
}

/**
 * Agent update event - Fired when copilot/agent status changes
 */
export interface AgentUpdateEvent {
  type: 'AGENT_UPDATE';
  caseId: string;
  agentId: string;
  status: 'working' | 'suggesting' | 'complete' | 'error';
  payload: {
    message?: string;
    artifacts?: unknown[];
    progress?: number;
  };
  timestamp: string;
}

/**
 * Collaborative edit event - Fired when another user edits the graph
 */
export interface CollaborativeEditEvent {
  type: 'COLLABORATIVE_EDIT';
  caseId: string;
  userId: string;
  userName: string;
  changes: Array<{
    nodeId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  timestamp: string;
}

/**
 * Checkpoint reminder event - Fired when a realization checkpoint is due
 */
export interface CheckpointReminderEvent {
  type: 'CHECKPOINT_REMINDER';
  caseId: string;
  checkpointId: string;
  checkpointName: string;
  dueDate: string;
  daysOverdue: number;
}

/**
 * All workspace event types
 */
export type WorkspaceEvent =
  | WarmthTransitionEvent
  | AgentUpdateEvent
  | CollaborativeEditEvent
  | CheckpointReminderEvent;

/**
 * Type guard for warmth transition events
 */
export function isWarmthTransitionEvent(event: WorkspaceEvent): event is WarmthTransitionEvent {
  return event.type === 'WARMTH_TRANSITION';
}

/**
 * Type guard for agent update events
 */
export function isAgentUpdateEvent(event: WorkspaceEvent): event is AgentUpdateEvent {
  return event.type === 'AGENT_UPDATE';
}

/**
 * Type guard for collaborative edit events
 */
export function isCollaborativeEditEvent(event: WorkspaceEvent): event is CollaborativeEditEvent {
  return event.type === 'COLLABORATIVE_EDIT';
}
