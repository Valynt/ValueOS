/**
 * Conversation History Service
 * 
 * Persists conversation history to Supabase for value cases.
 * Supports real-time sync and local caching for offline support.
 */

import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'

// ============================================================================
// Types
// ============================================================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentName?: string;
  confidence?: number;
  reasoning?: string[];
  sduiPage?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ConversationHistory {
  id: string;
  caseId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Local Cache
// ============================================================================

const conversationCache = new Map<string, ConversationHistory>();

// ============================================================================
// Service
// ============================================================================

class ConversationHistoryService {
  private tableName = 'conversation_history';

  /**
   * Get conversation history for a case.
   * tenantId is required to enforce tenant isolation — queries without it are rejected.
   */
  async getHistory(caseId: string, tenantId: string): Promise<ConversationHistory | null> {
    // Check cache first
    const cached = conversationCache.get(`${tenantId}:${caseId}`);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await (supabase as any)
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        // Table might not exist, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.warn('Failed to fetch conversation history', { error });
        return null;
      }

      if (!data) return null;

      const history: ConversationHistory = {
        id: data.id,
        caseId: data.case_id,
        messages: data.messages || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      conversationCache.set(`${tenantId}:${caseId}`, history);
      return history;
    } catch (error: unknown) {
      logger.error('Error fetching conversation history', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Add a message to the conversation.
   * tenantId is required to enforce tenant isolation.
   */
  async addMessage(caseId: string, tenantId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<ConversationMessage> {
    const newMessage: ConversationMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      // Get existing history
      let history = await this.getHistory(caseId, tenantId);

      if (!history) {
        // Create new history
        history = {
          id: crypto.randomUUID(),
          caseId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Add message
      history.messages.push(newMessage);
      history.updatedAt = new Date();

      // Update cache
      conversationCache.set(`${tenantId}:${caseId}`, history);

      // Persist to database (fire and forget, don't block)
      this.persistHistory(history, tenantId).catch((err: unknown) => {
        logger.warn('Failed to persist conversation history', { error: err });
      });

      return newMessage;
    } catch (error: unknown) {
      logger.error('Error adding message', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Persist history to database.
   * tenantId is included in the upsert payload and the conflict key
   * to ensure rows are scoped per tenant.
   */
  private async persistHistory(history: ConversationHistory, tenantId: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(this.tableName)
        .upsert({
          id: history.id,
          tenant_id: tenantId,
          case_id: history.caseId,
          messages: history.messages,
          created_at: history.createdAt.toISOString(),
          updated_at: history.updatedAt.toISOString(),
        }, { onConflict: 'case_id,tenant_id' });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      logger.error('Error persisting conversation history', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Get recent messages for context.
   * tenantId is required to enforce tenant isolation.
   */
  async getRecentMessages(caseId: string, tenantId: string, limit: number = 10): Promise<ConversationMessage[]> {
    const history = await this.getHistory(caseId, tenantId);
    if (!history) return [];

    return history.messages.slice(-limit);
  }

  /**
   * Clear conversation history for a case.
   * tenantId is required to enforce tenant isolation.
   */
  async clearHistory(caseId: string, tenantId: string): Promise<void> {
    conversationCache.delete(`${tenantId}:${caseId}`);

    try {
      await (supabase as any)
        .from(this.tableName)
        .delete()
        .eq('case_id', caseId)
        .eq('tenant_id', tenantId);
    } catch (error: unknown) {
      logger.warn('Failed to clear conversation history from database', { error });
    }
  }

  /**
   * Export conversation as formatted text
   */
  async exportConversation(caseId: string): Promise<string> {
    const history = await this.getHistory(caseId);
    if (!history || history.messages.length === 0) {
      return 'No conversation history found.';
    }

    return history.messages
      .map(msg => {
        const role = msg.role === 'user' ? 'You' : (msg.agentName || 'Assistant');
        const time = new Date(msg.timestamp).toLocaleString();
        return `[${time}] ${role}:\n${msg.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Format messages for LLM context
   */
  formatForLLM(messages: ConversationMessage[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}

// Export singleton
export const conversationHistoryService = new ConversationHistoryService();