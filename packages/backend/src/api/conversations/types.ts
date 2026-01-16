/**
 * Conversations API Types
 * 
 * Type definitions for conversation/message persistence.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const MessageRole = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRole>;

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Message metadata schema
 */
export const MessageMetadataSchema = z.object({
  reasoning: z.string().max(5000).optional(),
  sources: z.array(z.string().max(500)).max(20).optional(),
  confidence: z.number().min(0).max(1).optional(),
  artifactIds: z.array(z.string().uuid()).max(50).optional(),
  agentRunId: z.string().max(100).optional(),
  checkpointId: z.string().max(100).optional(),
}).strict();

export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

/**
 * Create message request
 */
export const CreateMessageSchema = z.object({
  caseId: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  role: MessageRole,
  content: z.string()
    .min(1, 'Content is required')
    .max(100000, 'Content must be 100000 characters or less'),
  metadata: MessageMetadataSchema.optional(),
}).strict();

export type CreateMessageRequest = z.infer<typeof CreateMessageSchema>;

/**
 * Batch create messages request
 */
export const BatchCreateMessagesSchema = z.object({
  caseId: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  messages: z.array(z.object({
    role: MessageRole,
    content: z.string().min(1).max(100000),
    metadata: MessageMetadataSchema.optional(),
    timestamp: z.number().optional(), // Unix timestamp for ordering
  })).min(1).max(100),
}).strict();

export type BatchCreateMessagesRequest = z.infer<typeof BatchCreateMessagesSchema>;

/**
 * List messages query params
 */
export const ListMessagesQuerySchema = z.object({
  caseId: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  role: MessageRole.optional(),
  since: z.coerce.date().optional(), // ISO timestamp
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

// ============================================================================
// Session Schemas
// ============================================================================

/**
 * Save session request - saves entire conversation state
 */
export const SaveSessionSchema = z.object({
  caseId: z.string().uuid(),
  messages: z.array(z.object({
    id: z.string(),
    role: MessageRole,
    content: z.string().min(1).max(100000),
    timestamp: z.number(),
    metadata: MessageMetadataSchema.optional(),
  })).max(500),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    status: z.string(),
  })).max(100).optional(),
  phase: z.string().optional(),
  lastRunId: z.string().optional(),
}).strict();

export type SaveSessionRequest = z.infer<typeof SaveSessionSchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Message entity (API response)
 */
export interface Message {
  id: string;
  tenantId: string;
  userId: string;
  caseId: string;
  workflowId?: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

/**
 * Conversation session (loaded state)
 */
export interface ConversationSession {
  caseId: string;
  messages: Message[];
  artifactIds: string[];
  lastRunId?: string;
  loadedAt: Date;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
