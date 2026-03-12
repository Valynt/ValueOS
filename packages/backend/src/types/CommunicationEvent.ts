/**
 * Communication Event Types
 */

type TenantIdentity =
  | {
      tenant_id: string;
      organization_id?: string;
    }
  | {
      organization_id: string;
      tenant_id?: string;
    };

interface CommunicationEventCore {
  event_type: 'message' | 'notification' | 'alert' | 'broadcast';
  sender_id: string;
  recipient_ids: string[];
  recipient_agent?: string;
  message_type?: string;
  correlation_id?: string;
  reply_to?: string;
  content: string;
  payload?: unknown;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

export type CreateCommunicationEvent = CommunicationEventCore & TenantIdentity;

export type CommunicationEvent = CreateCommunicationEvent & {
  id: string;
  timestamp: string;
};

export interface MessageHandler {
  channel: string;
  agent_name: string;
  handler: (event: CommunicationEvent) => Promise<void>;
  filter?: (event: CommunicationEvent) => boolean;
}

export interface ChannelConfig {
  name: string;
  description: string;
  persistent: boolean;
  message_retention?: number;
}

export interface MessageStats {
  channel: string;
  total_messages: number;
  messages_per_second: number;
  active_subscribers: number;
  failed_deliveries: number;
  average_latency_ms: number;
}
