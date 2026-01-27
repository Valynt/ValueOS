/**
 * SecureMessageBus
 */

import { EventEmitter } from 'events';

export class SecureMessageBus extends EventEmitter {
  private subscribers: Map<string, Function[]> = new Map();

  publish(event: string, data: any): void {
    const handlers = this.subscribers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  subscribe(event: string, handler: Function): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(handler);
  }

  unsubscribe(event: string, handler: Function): void {
    const handlers = this.subscribers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
}

export const securemessagebus = new SecureMessageBus();
