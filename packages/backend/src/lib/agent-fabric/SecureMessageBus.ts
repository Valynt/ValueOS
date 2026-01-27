/**
 * SecureMessageBus
 */

import { EventEmitter } from 'events';
import { AgentIdentity } from '../auth/AgentIdentity';

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SecureMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  payload: any;
  priority: MessagePriority;
  encrypted: boolean;
  correlationId?: string;
  replyTo?: string;
  timestamp: Date;
}

export interface SendOptions {
  priority?: MessagePriority;
  encrypted?: boolean;
  correlationId?: string;
  replyTo?: string;
}

export class SecureMessageBus extends EventEmitter {
  private subscribers: Map<string, { handler: Function; patterns?: string[] }[]> = new Map();

  async send(
    from: string,
    to: string,
    payload: any,
    options: SendOptions = {}
  ): Promise<SecureMessage> {
    const message: SecureMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId: from,
      toAgentId: to,
      payload,
      priority: options.priority || 'normal',
      encrypted: options.encrypted || false,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      timestamp: new Date(),
    };

    // Emit to subscribers
    const handlers = this.subscribers.get(to) || [];
    for (const { handler, patterns } of handlers) {
      if (!patterns || patterns.includes('*') || patterns.includes(from)) {
        handler(message, { agent_id: from, agent_type: 'unknown', organization_id: '', permissions: [], issued_at: '', expires_at: '' } as AgentIdentity);
      }
    }

    return message;
  }

  subscribe(
    event: string,
    handler: (message: SecureMessage, sender: AgentIdentity) => void,
    patterns?: string[]
  ): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push({ handler, patterns });
  }

  unsubscribe(event: string, handler: Function): void {
    const handlers = this.subscribers.get(event) || [];
    const index = handlers.findIndex(h => h.handler === handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
}

export const secureMessageBus = new SecureMessageBus();
