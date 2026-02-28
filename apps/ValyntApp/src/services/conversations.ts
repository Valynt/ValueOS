/**
 * Conversations Service
 * 
 * Client-side service for persisting and loading conversation sessions.
 * Connects the agent UI to the backend conversations API.
 */

import { api } from './api/client';

import type { ConversationMessage } from '@/features/workspace/agent/types';

// ============================================================================
// Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageMetadata {
  reasoning?: string;
  sources?: string[];
  confidence?: number;
  artifactIds?: string[];
  agentRunId?: string;
  checkpointId?: string;
}

export interface PersistedMessage {
  id: string;
  tenantId: string;
  userId: string;
  caseId: string;
  workflowId?: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  createdAt: string;
}

export interface ConversationSession {
  caseId: string;
  messages: PersistedMessage[];
  artifactIds: string[];
  lastRunId?: string;
  loadedAt: string;
}

export interface SaveSessionRequest {
  caseId: string;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    metadata?: MessageMetadata;
  }>;
  artifacts?: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
  }>;
  phase?: string;
  lastRunId?: string;
}

export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

const API_BASE = '/v1/conversations';

/**
 * Conversations service for client-side usage
 */
class ConversationsService {
  /**
   * Load a conversation session for a case
   */
  async loadSession(caseId: string): Promise<ConversationSession> {
    const response = await api.get<ApiResponse<ConversationSession>>(
      `${API_BASE}/session/${caseId}`
    );
    return response.data;
  }

  /**
   * Save a conversation session
   */
  async saveSession(caseId: string, request: SaveSessionRequest): Promise<{ messageCount: number; savedAt: string }> {
    const response = await api.post<ApiResponse<{ caseId: string; messageCount: number; savedAt: string }>>(
      `${API_BASE}/session/${caseId}`,
      request
    );
    return response.data;
  }

  /**
   * Clear all messages for a case
   */
  async clearSession(caseId: string): Promise<{ deletedCount: number }> {
    const response = await api.delete<ApiResponse<{ caseId: string; deletedCount: number }>>(
      `${API_BASE}/session/${caseId}`
    );
    return response.data;
  }

  /**
   * Get messages for a case
   */
  async getMessages(caseId: string, options?: {
    workflowId?: string;
    role?: MessageRole;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PersistedMessage[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      caseId,
    };
    
    if (options?.workflowId) params.workflowId = options.workflowId;
    if (options?.role) params.role = options.role;
    if (options?.since) params.since = options.since.toISOString();
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await api.get<ApiResponse<PersistedMessage[]>>(
      `${API_BASE}/messages`,
      { params }
    );
    return response.data;
  }

  /**
   * Create a batch of messages
   */
  async createMessagesBatch(
    caseId: string,
    messages: Array<{
      role: MessageRole;
      content: string;
      metadata?: MessageMetadata;
      timestamp?: number;
    }>,
    workflowId?: string
  ): Promise<PersistedMessage[]> {
    const response = await api.post<ApiResponse<PersistedMessage[]>>(
      `${API_BASE}/messages/batch`,
      { caseId, workflowId, messages }
    );
    return response.data;
  }

  /**
   * Convert UI ConversationMessage to API format
   */
  toApiMessage(msg: ConversationMessage): {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    metadata?: MessageMetadata;
  } {
    return {
      id: msg.id,
      // Map 'agent' to 'assistant' for API
      role: msg.role === 'agent' ? 'assistant' : msg.role as MessageRole,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata ? {
        reasoning: msg.metadata.reasoning,
        sources: msg.metadata.sources,
        confidence: msg.metadata.confidence,
        artifactIds: msg.metadata.artifactIds,
      } : undefined,
    };
  }

  /**
   * Convert API message to UI ConversationMessage
   */
  toUIMessage(msg: PersistedMessage): ConversationMessage {
    return {
      id: msg.id,
      // Map 'assistant' to 'agent' for UI
      role: msg.role === 'assistant' ? 'agent' : msg.role as ConversationMessage['role'],
      content: msg.content,
      timestamp: new Date(msg.createdAt).getTime(),
      metadata: msg.metadata ? {
        reasoning: msg.metadata.reasoning,
        sources: msg.metadata.sources,
        confidence: msg.metadata.confidence,
        artifactIds: msg.metadata.artifactIds,
      } : undefined,
    };
  }

  /**
   * Convert a session to UI messages
   */
  sessionToUIMessages(session: ConversationSession): ConversationMessage[] {
    return session.messages.map(this.toUIMessage);
  }
}

// Export singleton instance
export const conversationsService = new ConversationsService();

// Export class for custom instances
export { ConversationsService };
