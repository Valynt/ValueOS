/**
 * DomainEventBus
 *
 * Thin pub/sub layer for domain events. Uses Redis Pub/Sub when a Redis
 * client is injected; falls back to in-process delivery for tests and
 * local development without Redis.
 *
 * All events are validated against their Zod schema before publishing.
 * Subscribers receive typed payloads. trace_id is propagated on every
 * event for distributed tracing.
 *
 * Usage:
 *   const bus = getDomainEventBus();
 *   bus.subscribe('opportunity.updated', async (payload) => { ... });
 *   await bus.publish('opportunity.updated', payload);
 */

import { logger } from '../utils/logger.js';

import {
  DomainEventName,
  DomainEventPayloadMap,
  validateDomainEvent,
} from './DomainEventSchemas.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DomainEventHandler<TName extends DomainEventName> = (
  payload: DomainEventPayloadMap[TName],
) => Promise<void>;

interface Subscription<TName extends DomainEventName> {
  name: TName;
  handler: DomainEventHandler<TName>;
}

// ---------------------------------------------------------------------------
// DomainEventBus
// ---------------------------------------------------------------------------

export class DomainEventBus {
  // Keyed by event name; each entry is a Set of handlers
  private readonly subscribers = new Map<
    DomainEventName,
    Set<DomainEventHandler<DomainEventName>>
  >();

  // Optional Redis clients for cross-process delivery
  private readonly redisPub: RedisLike | null;
  private readonly redisSub: RedisLike | null;

  constructor(config?: { redisPub?: RedisLike; redisSub?: RedisLike }) {
    this.redisPub = config?.redisPub ?? null;
    this.redisSub = config?.redisSub ?? null;

    if (this.redisSub) {
      this.attachRedisSubscriber();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Publish a domain event. Validates the payload, then delivers to all
   * in-process subscribers and (if configured) publishes to Redis.
   */
  async publish<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloadMap[TName],
  ): Promise<void> {
    const validated = validateDomainEvent(name, payload);

    const v = validated as Record<string, unknown>;
    logger.info('domain_event.published', {
      event: name,
      id: v['id'],
      traceId: v['traceId'],
      tenantId: v['tenantId'],
    });

    await this.deliverLocally(name, validated);

    if (this.redisPub) {
      await this.publishToRedis(name, validated);
    }
  }

  /**
   * Subscribe to a domain event. Returns an unsubscribe function.
   */
  subscribe<TName extends DomainEventName>(
    name: TName,
    handler: DomainEventHandler<TName>,
  ): () => void {
    if (!this.subscribers.has(name)) {
      this.subscribers.set(name, new Set());
    }

    // Cast is safe: the Set is keyed by TName
    const handlers = this.subscribers.get(name)! as Set<DomainEventHandler<TName>>;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  // ---------------------------------------------------------------------------
  // Internal delivery
  // ---------------------------------------------------------------------------

  private async deliverLocally<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloadMap[TName],
  ): Promise<void> {
    const handlers = this.subscribers.get(name);
    if (!handlers || handlers.size === 0) return;

    const deliveries = Array.from(handlers).map((h) =>
      (h as DomainEventHandler<TName>)(payload).catch((err: unknown) => {
        logger.error('domain_event.handler_error', err instanceof Error ? err : undefined, {
          event: name,
          id: (payload as { id: string }).id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    );

    await Promise.all(deliveries);
  }

  private async publishToRedis<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloadMap[TName],
  ): Promise<void> {
    try {
      // Tag with the originating process so the subscriber can skip local
      // re-delivery on the same process (prevents double-firing).
      await this.redisPub!.publish(
        `domain:${name}`,
        JSON.stringify({ name, payload, originPid: process.pid }),
      );
    } catch (err) {
      logger.error('domain_event.redis_publish_error', err instanceof Error ? err : undefined, {
        event: name,
      });
    }
  }

  private attachRedisSubscriber(): void {
    // Subscribe to all domain event channels via pattern.
    // Skip local delivery when the message originated from this process —
    // publish() already called deliverLocally() before writing to Redis.
    this.redisSub!.psubscribe('domain:*', (message: string, channel: string) => {
      try {
        const { name, payload, originPid } = JSON.parse(message) as {
          name: DomainEventName;
          payload: unknown;
          originPid?: number;
        };

        if (originPid === process.pid) {
          // Same process published this event; local subscribers were already
          // notified synchronously in publish(). Nothing to do.
          return;
        }

        const validated = validateDomainEvent(name, payload);
        this.deliverLocally(name, validated).catch((err: unknown) => {
          logger.error('domain_event.redis_delivery_error', err instanceof Error ? err : undefined, {
            channel,
          });
        });
      } catch (err) {
        logger.error('domain_event.redis_parse_error', err instanceof Error ? err : undefined, {
          channel,
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Minimal Redis interface (avoids hard ioredis dependency in this module)
// ---------------------------------------------------------------------------

export interface RedisLike {
  publish(channel: string, message: string): Promise<unknown>;
  psubscribe(pattern: string, callback: (message: string, channel: string) => void): void;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: DomainEventBus | null = null;

export function getDomainEventBus(config?: {
  redisPub?: RedisLike;
  redisSub?: RedisLike;
}): DomainEventBus {
  if (!instance) {
    instance = new DomainEventBus(config);
  }
  return instance;
}

/** Reset the singleton — for tests only. */
export function _resetDomainEventBusForTests(): void {
  instance = null;
}

// ---------------------------------------------------------------------------
// Helper: build a minimal event envelope
// ---------------------------------------------------------------------------

export function buildEventEnvelope(opts: {
  traceId: string;
  tenantId: string;
  actorId: string;
}): { id: string; emittedAt: string; traceId: string; tenantId: string; actorId: string } {
  return {
    id: crypto.randomUUID(),
    emittedAt: new Date().toISOString(),
    traceId: opts.traceId,
    tenantId: opts.tenantId,
    actorId: opts.actorId,
  };
}
