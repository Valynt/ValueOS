/**
 * Communication Event Types
 */

export interface CommunicationEvent {
  id: string;
  event_type: 'message' | 'notification' | 'alert' | 'broadcast';
  sender_id: string;
  recipient_ids: string[];
  content: string;
  payload?: unknown;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
