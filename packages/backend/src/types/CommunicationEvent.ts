/**
 * Communication Event Types
 *
 * Used by realtime/MessageBus for inter-service messaging (billing alerts,
 * broadcast path). Every event must carry tenant_id so consumers can enforce
 * tenant isolation without inspecting the payload.
 */

export type {
  ChannelConfig,
  CommunicationEvent,
  CommunicationEventCore,
  CreateCommunicationEvent,
  MessageHandler,
  MessageStats,
  TenantIdentity,
} from '@valueos/shared/types/communication-event';
