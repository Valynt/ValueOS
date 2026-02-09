/**
 * Shared types for the agent middleware pipeline.
 */

import { AgentType } from '../agent-types.js';

// ============================================================================
// Checkpoint (HITL) Types
// ============================================================================

export interface CheckpointRecord {
  checkpointId: string;
  agentType: AgentType;
  intent: string;
  riskLevel: 'medium' | 'high' | 'critical';
  riskReason: string;
  serializedContext: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  timeoutMs: number;
}

export interface RiskClassification {
  isHighRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  requiresApproval: boolean;
}

export interface CheckpointConfig {
  enabled: boolean;
  /** Default timeout in ms (default: 1_800_000 = 30 min) */
  defaultTimeoutMs: number;
  highRiskIntents: string[];
  highRiskAgentTypes: AgentType[];
  bypassRoles?: string[];
}

export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  enabled: true,
  defaultTimeoutMs: 1_800_000,
  highRiskIntents: [
    'crm_write',
    'financial_calculation',
    'data_export',
    'destructive_action',
  ],
  highRiskAgentTypes: ['financial-modeling'],
  bypassRoles: ['admin'],
};

// ============================================================================
// Handover Types
// ============================================================================

export interface CapabilityRequest {
  capability: string;
  inputData: Record<string, unknown>;
  outputMapping?: Record<string, string>;
  mergeKey: string;
  priority?: 'low' | 'normal' | 'high';
  timeoutMs?: number;
}

export interface HandoverResult {
  success: boolean;
  targetAgent?: string;
  targetTool?: string;
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Adversarial I/O Types
// ============================================================================

export interface AdversarialIOConfig {
  enabled: boolean;
  inputScreening: {
    enabled: boolean;
    blockedKeywords: string[];
    injectionPatterns: RegExp[];
    promptInjectionPatterns: RegExp[];
    maxInputLength: number;
  };
  outputScreening: {
    enabled: boolean;
    blockedKeywords: string[];
    enableGroundTruthCheck: boolean;
  };
  fallbackMessage: string;
  outputFallbackMessage: string;
}

export const DEFAULT_ADVERSARIAL_IO_CONFIG: AdversarialIOConfig = {
  enabled: true,
  inputScreening: {
    enabled: true,
    blockedKeywords: [
      'jailbreak',
      'developer mode',
      'DAN mode',
      'ignore previous instructions',
      'ignore all instructions',
      'bypass safety',
      'override system prompt',
    ],
    injectionPatterns: [
      /<script[\s>]/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ],
    promptInjectionPatterns: [
      /^\s*system:/i,
      /^\s*ignore\s+(previous|all)/i,
      /developer\s+mode/i,
      /you\s+are\s+now\s+(in\s+)?unrestricted/i,
    ],
    maxInputLength: 2000,
  },
  outputScreening: {
    enabled: true,
    blockedKeywords: [],
    enableGroundTruthCheck: true,
  },
  fallbackMessage:
    "I'm unable to process this request. Please rephrase your query.",
  outputFallbackMessage:
    'The response could not be verified for accuracy. Please try again.',
};

// ============================================================================
// Checkpoint Errors
// ============================================================================

export class CheckpointTimeoutError extends Error {
  constructor(
    public readonly checkpointId: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Checkpoint ${checkpointId} timed out after ${timeoutMs}ms`,
    );
    this.name = 'CheckpointTimeoutError';
  }
}

export class CheckpointRejectedError extends Error {
  constructor(
    public readonly checkpointId: string,
    public readonly reason: string,
    public readonly rejectedBy?: string,
  ) {
    super(`Checkpoint ${checkpointId} rejected: ${reason}`);
    this.name = 'CheckpointRejectedError';
  }
}
