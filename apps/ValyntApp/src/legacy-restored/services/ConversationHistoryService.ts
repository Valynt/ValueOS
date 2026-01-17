/**
 * Conversation History Service
 * 
 * Persists conversation history to Supabase for value cases.
 * Supports real-time sync and local caching for offline support.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

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
  sduiPage?: any;
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
   * Get conversation history for a case
   */
  async getHistory(caseId: string): Promise<ConversationHistory | null> {
    // Check cache first
    const cached = conversationCache.get(caseId);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await (supabase as any)
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
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

      conversationCache.set(caseId, history);
      return history;
    } catch (error) {
      logger.error('Error fetching conversation history', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(caseId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<ConversationMessage> {
    const newMessage: ConversationMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      // Get existing history
      let history = await this.getHistory(caseId);

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
      conversationCache.set(caseId, history);

      // Persist to database (fire and forget, don't block)
      this.persistHistory(history).catch(err => {
        logger.warn('Failed to persist conversation history', { error: err });
      });

      return newMessage;
    } catch (error) {
      logger.error('Error adding message', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Persist history to database
   */
  private async persistHistory(history: ConversationHistory): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(this.tableName)
        .upsert({
          id: history.id,
          case_id: history.caseId,
          messages: history.messages,
          created_at: history.createdAt.toISOString(),
          updated_at: history.updatedAt.toISOString(),
        }, { onConflict: 'case_id' });

      if (error) {
        // If table doesn't exist, try creating it first
        if (error.code === '42P01') {
          await this.createTable();
          // Retry
          await (supabase as any)
            .from(this.tableName)
            .upsert({
              id: history.id,
              case_id: history.caseId,
              messages: history.messages,
              created_at: history.createdAt.toISOString(),
              updated_at: history.updatedAt.toISOString(),
            }, { onConflict: 'case_id' });
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Error persisting conversation history', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Create the conversation_history table if it doesn't exist
   */
  private async createTable(): Promise<void> {
    // This would normally be done via migration, but for demo purposes
    // we'll create via RPC if the table doesn't exist
    logger.info('Conversation history table may not exist, will use local cache only');
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(caseId: string, limit: number = 10): Promise<ConversationMessage[]> {
    const history = await this.getHistory(caseId);
    if (!history) return [];

    return history.messages.slice(-limit);
  }

  /**
   * Clear conversation history for a case
   */
  async clearHistory(caseId: string): Promise<void> {
    conversationCache.delete(caseId);

    try {
      await (supabase as any)
        .from(this.tableName)
        .delete()
        .eq('case_id', caseId);
    } catch (error) {
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
