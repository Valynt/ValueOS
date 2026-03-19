/**
 * Conversations Repository
 *
 * Data access layer for conversation messages with Supabase/Postgres.
 * Uses the existing messages table with tenant isolation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';

import { logger } from "../../lib/logger.js";
import { createUserSupabaseClient } from '../../lib/supabase.js';

import {
  ConversationSession,
  CreateMessageRequest,
  ListMessagesQuery,
  Message,
  MessageMetadata,
  MessageRole,
} from './types';



// ============================================================================
// Repository Errors
// ============================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND');
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
  }
}

// ============================================================================
// Database Row Type
// ============================================================================

interface MessageRow {
  id: string;
  tenant_id: string;
  user_id: string;
  case_id: string | null;
  workflow_id: string | null;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class ConversationsRepository {
  private supabase: SupabaseClient;
  private tableName = 'messages';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static fromRequest(req: Request): ConversationsRepository {
    if (req.supabase) {
      return new ConversationsRepository(req.supabase);
    }
    const token = (req.session as Record<string, unknown> | undefined)?.access_token;
    if (typeof token === 'string') {
      return new ConversationsRepository(createUserSupabaseClient(token));
    }
    throw new Error('ConversationsRepository.fromRequest: no user-scoped Supabase client available on request');
  }

  /**
   * Create a new message
   */
  async create(
    tenantId: string,
    userId: string,
    data: CreateMessageRequest
  ): Promise<Message> {
    const correlationId = `msg-create-${Date.now()}`;

    try {
      const messageData = {
        tenant_id: tenantId,
        user_id: userId,
        case_id: data.caseId,
        workflow_id: data.workflowId || null,
        role: data.role,
        content: data.content,
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(messageData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create message', {
          correlationId,
          tenantId,
          error: error.message,
          code: error.code,
        });
        throw new DatabaseError('Failed to create message', error);
      }

      logger.info('Message created', {
        correlationId,
        tenantId,
        messageId: result.id,
        caseId: data.caseId,
        role: data.role,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;

      logger.error('Unexpected error creating message', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating message', err as Error);
    }
  }

  /**
   * Create multiple messages in a batch
   */
  async createBatch(
    tenantId: string,
    userId: string,
    caseId: string,
    workflowId: string | undefined,
    messages: Array<{
      role: MessageRole;
      content: string;
      metadata?: MessageMetadata;
      timestamp?: number;
    }>
  ): Promise<Message[]> {
    const correlationId = `msg-batch-${Date.now()}`;

    try {
      const messageRows = messages.map((msg, index) => ({
        tenant_id: tenantId,
        user_id: userId,
        case_id: caseId,
        workflow_id: workflowId || null,
        role: msg.role,
        content: msg.content,
        metadata: {
          ...msg.metadata,
          originalTimestamp: msg.timestamp,
          batchIndex: index,
        },
        created_at: msg.timestamp
          ? new Date(msg.timestamp).toISOString()
          : new Date().toISOString(),
      }));

      const { data: results, error } = await this.supabase
        .from(this.tableName)
        .insert(messageRows)
        .select();

      if (error) {
        logger.error('Failed to create messages batch', {
          correlationId,
          tenantId,
          caseId,
          count: messages.length,
          error: error.message,
        });
        throw new DatabaseError('Failed to create messages batch', error);
      }

      logger.info('Messages batch created', {
        correlationId,
        tenantId,
        caseId,
        count: results?.length || 0,
      });

      return (results || []).map(this.mapToEntity);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;

      logger.error('Unexpected error creating messages batch', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating messages batch', err as Error);
    }
  }

  /**
   * Get messages for a case
   */
  async getByCase(
    tenantId: string,
    query: ListMessagesQuery
  ): Promise<Message[]> {
    const correlationId = `msg-list-${query.caseId}`;

    try {
      let queryBuilder = this.supabase
        .from(this.tableName)
        .select()
        .eq('tenant_id', tenantId)
        .eq('case_id', query.caseId)
        .order('created_at', { ascending: true });

      if (query.workflowId) {
        queryBuilder = queryBuilder.eq('workflow_id', query.workflowId);
      }

      if (query.role) {
        queryBuilder = queryBuilder.eq('role', query.role);
      }

      if (query.since) {
        queryBuilder = queryBuilder.gte('created_at', query.since.toISOString());
      }

      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);
      } else {
        queryBuilder = queryBuilder.limit(query.limit);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        logger.error('Failed to get messages', {
          correlationId,
          tenantId,
          caseId: query.caseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to get messages', error);
      }

      return (data || []).map(this.mapToEntity);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;

      logger.error('Unexpected error getting messages', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error getting messages', err as Error);
    }
  }

  /**
   * Load a conversation session for a case
   */
  async loadSession(
    tenantId: string,
    caseId: string
  ): Promise<ConversationSession> {
    const correlationId = `session-load-${caseId}`;

    try {
      // Get all messages for the case
      const messages = await this.getByCase(tenantId, {
        caseId,
        limit: 500,
        offset: 0,
      });

      // Extract artifact IDs from message metadata
      const artifactIds = new Set<string>();
      let lastRunId: string | undefined;

      for (const msg of messages) {
        if (msg.metadata?.artifactIds) {
          for (const id of msg.metadata.artifactIds) {
            artifactIds.add(id);
          }
        }
        if (msg.metadata?.agentRunId) {
          lastRunId = msg.metadata.agentRunId;
        }
      }

      logger.info('Session loaded', {
        correlationId,
        tenantId,
        caseId,
        messageCount: messages.length,
        artifactCount: artifactIds.size,
      });

      return {
        caseId,
        messages,
        artifactIds: Array.from(artifactIds),
        lastRunId,
        loadedAt: new Date(),
      };
    } catch (err) {
      if (err instanceof RepositoryError) throw err;

      logger.error('Unexpected error loading session', {
        correlationId,
        tenantId,
        caseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error loading session', err as Error);
    }
  }

  /**
   * Delete all messages for a case (for reset/clear)
   */
  async deleteByCase(tenantId: string, caseId: string): Promise<number> {
    const correlationId = `msg-delete-${caseId}`;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('tenant_id', tenantId)
        .eq('case_id', caseId)
        .select('id');

      if (error) {
        logger.error('Failed to delete messages', {
          correlationId,
          tenantId,
          caseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to delete messages', error);
      }

      const count = data?.length || 0;
      logger.info('Messages deleted', {
        correlationId,
        tenantId,
        caseId,
        count,
      });

      return count;
    } catch (err) {
      if (err instanceof RepositoryError) throw err;

      logger.error('Unexpected error deleting messages', {
        correlationId,
        tenantId,
        caseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error deleting messages', err as Error);
    }
  }

  /**
   * Map database row to entity
   */
  private mapToEntity(row: MessageRow): Message {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      caseId: row.case_id || '',
      workflowId: row.workflow_id || undefined,
      role: row.role as MessageRole,
      content: row.content,
      metadata: row.metadata as MessageMetadata | undefined,
      createdAt: new Date(row.created_at),
    };
  }
}


export function getConversationsRepository(req?: Request): ConversationsRepository {
  if (!req) {
    throw new Error("getConversationsRepository now requires an Express request so it can build a user-scoped Supabase client");
  }

  return ConversationsRepository.fromRequest(req);
}
