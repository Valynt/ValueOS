/**
 * CommunicatorAgent - Inter-Agent Communication Manager
 * 
 * Responsible for:
 * - Managing message routing between agents
 * - Handling request-response patterns
 * - Broadcasting system events
 * - Message compression and optimization
 */

import { v4 as uuidv4 } from 'uuid';
import { getMessageBus } from '../services/MessageBus';
import type {
  CommunicationEvent,
  CreateCommunicationEvent,
  MessageHandler,
} from '../types/CommunicationEvent';

export class CommunicatorAgent {
  private messageBus: ReturnType<typeof getMessageBus>;
  private agentName: string;
  private subscriptions: Map<string, () => void>;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;

  constructor(agentName: string = 'CommunicatorAgent') {
    this.agentName = agentName;
    this.messageBus = getMessageBus();
    this.subscriptions = new Map();
    this.pendingRequests = new Map();

    // Subscribe to agent's dedicated channel
    this.subscribeToOwnChannel();
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(
    recipientAgent: string,
    messageType: CommunicationEvent['message_type'],
    payload: any,
    options?: {
      priority?: CommunicationEvent['priority'];
      correlationId?: string;
      ttl?: number;
    }
  ): Promise<string> {
    const event: CreateCommunicationEvent = {
      channel: this.getAgentChannel(recipientAgent),
      message_type: messageType,
      sender_agent: this.agentName,
      recipient_agent: recipientAgent,
      payload,
      priority: options?.priority || 'normal',
      correlation_id: options?.correlationId,
      ttl: options?.ttl,
    };

    return await this.messageBus.publishMessage(event.channel, event);
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(
    messageType: CommunicationEvent['message_type'],
    payload: any,
    options?: {
      priority?: CommunicationEvent['priority'];
    }
  ): Promise<void> {
    await this.messageBus.broadcast({
      channel: 'broadcast',
      message_type: messageType,
      sender_agent: this.agentName,
      payload,
      priority: options?.priority || 'normal',
    });
  }

  /**
   * Send a request and wait for response
   */
  async request(
    recipientAgent: string,
    payload: any,
    timeout: number = 5000
  ): Promise<any> {
    const correlationId = uuidv4();
    const replyChannel = `${this.agentName}.reply.${correlationId}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request to ${recipientAgent} timed out`));
      }, timeout);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // Subscribe to reply channel
      const unsubscribe = this.messageBus.subscribe(
        replyChannel,
        this.agentName,
        async (event) => {
          const pending = this.pendingRequests.get(correlationId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(correlationId);
            unsubscribe();
            resolve(event.payload);
          }
        }
      );

      // Send request
      this.sendMessage(recipientAgent, 'data_request', payload, {
        correlationId,
      }).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(correlationId);
        unsubscribe();
        reject(error);
      });
    });
  }

  /**
   * Reply to a request
   */
  async reply(
    originalEvent: CommunicationEvent,
    responsePayload: any
  ): Promise<void> {
    if (!originalEvent.reply_to || !originalEvent.correlation_id) {
      throw new Error('Cannot reply to event without reply_to or correlation_id');
    }

    await this.messageBus.publishMessage(originalEvent.reply_to, {
      channel: originalEvent.reply_to,
      message_type: 'data_response',
      sender_agent: this.agentName,
      recipient_agent: originalEvent.sender_agent,
      payload: responsePayload,
      correlation_id: originalEvent.correlation_id,
    });
  }

  /**
   * Subscribe to a channel
   */
  subscribe(
    channel: string,
    handler: (event: CommunicationEvent) => Promise<void>,
    filter?: (event: CommunicationEvent) => boolean
  ): () => void {
    const unsubscribe = this.messageBus.subscribe(
      channel,
      this.agentName,
      handler,
      filter
    );

    this.subscriptions.set(channel, unsubscribe);

    return () => {
      this.subscriptions.delete(channel);
      unsubscribe();
    };
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    const unsubscribe = this.subscriptions.get(channel);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(channel);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const unsubscribe of this.subscriptions.values()) {
      unsubscribe();
    }
    this.subscriptions.clear();
  }

  /**
   * Send task assignment to an agent
   */
  async assignTask(
    agentName: string,
    taskData: any,
    priority: CommunicationEvent['priority'] = 'normal'
  ): Promise<string> {
    return await this.sendMessage(agentName, 'task_assignment', taskData, {
      priority,
    });
  }

  /**
   * Notify task completion
   */
  async notifyTaskCompletion(
    coordinatorAgent: string,
    taskId: string,
    result: any
  ): Promise<void> {
    await this.sendMessage(coordinatorAgent, 'task_completion', {
      task_id: taskId,
      result,
      completed_at: new Date().toISOString(),
    });
  }

  /**
   * Notify task failure
   */
  async notifyTaskFailure(
    coordinatorAgent: string,
    taskId: string,
    error: string
  ): Promise<void> {
    await this.sendMessage(coordinatorAgent, 'task_failure', {
      task_id: taskId,
      error,
      failed_at: new Date().toISOString(),
    });
  }

  /**
   * Send status update
   */
  async sendStatusUpdate(status: any): Promise<void> {
    await this.messageBus.publishMessage('status', {
      channel: 'status',
      message_type: 'status_update',
      sender_agent: this.agentName,
      payload: {
        agent: this.agentName,
        status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat(): Promise<void> {
    await this.messageBus.publishMessage('status', {
      channel: 'status',
      message_type: 'heartbeat',
      sender_agent: this.agentName,
      payload: {
        agent: this.agentName,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get message bus statistics
   */
  getStats() {
    return this.messageBus.getAllStats();
  }

  /**
   * Get channel statistics
   */
  getChannelStats(channel: string) {
    return this.messageBus.getChannelStats(channel);
  }

  /**
   * Get message history
   */
  getMessageHistory(channel: string, limit?: number) {
    return this.messageBus.getMessageHistory(channel, limit);
  }

  // Private methods

  private subscribeToOwnChannel(): void {
    const channel = this.getAgentChannel(this.agentName);
    this.subscribe(channel, async (event) => {
      // Handle incoming messages
      console.log(`${this.agentName} received message:`, event);
    });
  }

  private getAgentChannel(agentName: string): string {
    return `agent.${agentName.toLowerCase()}`;
  }

  /**
   * Compress large payloads
   */
  compressPayload(payload: any): any {
    return this.messageBus.compressMessage(payload);
  }

  /**
   * Expand compressed payloads
   */
  expandPayload(payload: any): any {
    return this.messageBus.expandMessage(payload);
  }

  /**
   * Create a coordination request
   */
  async requestCoordination(
    coordinatorAgent: string,
    request: any
  ): Promise<any> {
    return await this.request(coordinatorAgent, {
      type: 'coordination_request',
      ...request,
    });
  }

  /**
   * Respond to coordination request
   */
  async respondToCoordination(
    originalEvent: CommunicationEvent,
    response: any
  ): Promise<void> {
    await this.reply(originalEvent, {
      type: 'coordination_response',
      ...response,
    });
  }
}

export default CommunicatorAgent;
