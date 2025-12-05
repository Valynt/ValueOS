/**
 * Communication Event Types
 * 
 * Defines message structures for inter-agent communication.
 */

import { z } from 'zod';

export const MessagePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export type MessagePriority = z.infer<typeof MessagePrioritySchema>;

export const MessageTypeSchema = z.enum([
  'task_assignment',
  'task_completion',
  'task_failure',
  'data_request',
  'data_response',
  'status_update',
  'coordination_request',
  'coordination_response',
  'broadcast',
  'heartbeat',
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const CommunicationEventSchema = z.object({
  id: z.string().uuid(),
  channel: z.string(),
  message_type: MessageTypeSchema,
  sender_agent: z.string(),
  recipient_agent: z.string().optional(),
  priority: MessagePrioritySchema.default('normal'),
  payload: z.record(z.any()),
  correlation_id: z.string().uuid().optional(),
  reply_to: z.string().optional(),
  timestamp: z.string().datetime(),
  ttl: z.number().int().positive().optional(),
  compressed: z.boolean().default(false),
});

export type CommunicationEvent = z.infer<typeof CommunicationEventSchema>;

export const CreateCommunicationEventSchema = CommunicationEventSchema.omit({
  id: true,
  timestamp: true,
}).partial({
  priority: true,
  compressed: true,
  recipient_agent: true,
  correlation_id: true,
  reply_to: true,
  ttl: true,
});

export type CreateCommunicationEvent = z.infer<typeof CreateCommunicationEventSchema>;

export const MessageHandlerSchema = z.object({
  channel: z.string(),
  agent_name: z.string(),
  handler: z.function(),
  filter: z.function().optional(),
});

export type MessageHandler = {
  channel: string;
  agent_name: string;
  handler: (event: CommunicationEvent) => Promise<void>;
  filter?: (event: CommunicationEvent) => boolean;
};

export const ChannelConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  persistent: z.boolean().default(false),
  max_subscribers: z.number().int().positive().optional(),
  message_retention: z.number().int().positive().optional(),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

export const MessageStatsSchema = z.object({
  channel: z.string(),
  total_messages: z.number().int(),
  messages_per_second: z.number(),
  active_subscribers: z.number().int(),
  failed_deliveries: z.number().int(),
  average_latency_ms: z.number(),
});

export type MessageStats = z.infer<typeof MessageStatsSchema>;
