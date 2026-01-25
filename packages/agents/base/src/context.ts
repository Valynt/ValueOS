/**
 * Context management utilities for agents
 */

import { logger } from "./logger.js";

export interface Message {
  role: string;
  content: string;
  [key: string]: any;
}

export interface ContextConfig {
  maxTokens: number;
  preserveSystemPrompt?: boolean;
}

export class ContextManager {
  private config: ContextConfig;

  constructor(config: ContextConfig) {
    this.config = config;
  }

  /**
   * Normalize text by collapsing multiple newlines to max two,
   * and trimming lines. Preserves structure better than compress.
   */
  normalize(text: string): string {
    return text
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Estimate token count (rough approximation)
   * 1 token ~= 4 characters for English text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Manage conversation history to stay within token limits
   * Preserves system prompt and prioritizes recent messages
   */
  manageConversation(messages: Message[]): Message[] {
    if (messages.length === 0) return [];

    let currentTokens = 0;
    const managedMessages: Message[] = [];
    const systemPrompts: Message[] = [];
    const otherMessages: Message[] = [];

    // Separate system prompts if preservation is enabled
    if (this.config.preserveSystemPrompt !== false) {
      messages.forEach((msg) => {
        if (msg.role === "system") {
          systemPrompts.push(msg);
          currentTokens += this.estimateTokens(msg.content);
        } else {
          otherMessages.push(msg);
        }
      });
    } else {
      otherMessages.push(...messages);
    }

    // If system prompts alone exceed limit (unlikely but possible), return them clipped or just them
    if (currentTokens >= this.config.maxTokens) {
      logger.warn("System prompts exceed max tokens, returning only system prompts", {
        tokenCount: currentTokens,
        maxTokens: this.config.maxTokens,
      });
      return systemPrompts;
    }

    // Add recent messages until limit is reached
    // Iterate backwards
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i];
      const tokens = this.estimateTokens(msg.content);

      if (currentTokens + tokens <= this.config.maxTokens) {
        managedMessages.unshift(msg);
        currentTokens += tokens;
      } else {
        logger.info("Context limit reached, truncating older messages", {
          keptMessages: managedMessages.length,
          totalMessages: otherMessages.length,
        });
        break;
      }
    }

    return [...systemPrompts, ...managedMessages];
  }
}
