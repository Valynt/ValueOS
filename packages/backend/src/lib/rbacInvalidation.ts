/**
 * RBAC cache invalidation via Redis pub/sub.
 *
 * When a role or permission assignment changes, the mutating service calls
 * publishRbacInvalidation(). Every server instance subscribed via
 * subscribeRbacInvalidation() receives the event and clears its local
 * PermissionService roleCache.
 *
 * Falls back gracefully when Redis is unavailable — in-process invalidation
 * still fires, so single-instance deployments are unaffected.
 */

import { logger } from "./logger.js";
import { createCounter } from "./observability/index.js";
import { getRedisClient } from "./redis.js";

/**
 * Incremented whenever Redis is unavailable for RBAC pub/sub.
 * A sustained non-zero rate means cross-instance cache invalidation is broken
 * and stale permission caches may persist until TTL expiry.
 * Runbook: docs/runbooks/rbac-redis-unavailable.md
 */
const redisUnavailableCounter = createCounter(
  "rbac_redis_unavailable_total",
  "Number of times Redis was unavailable for RBAC pub/sub (publish or subscribe path)",
);

const CHANNEL = "rbac:invalidate";

export interface RbacInvalidationEvent {
  /** Invalidate a specific role, or all roles when absent. */
  roleId?: string;
  /** Invalidate all cached entries for a specific user+tenant pair. */
  userId?: string;
  tenantId?: string;
  /** ISO timestamp for ordering / deduplication. */
  ts: string;
}

/**
 * Publish an invalidation event to all subscribed instances.
 * Fire-and-forget — failures are logged but never thrown.
 */
export async function publishRbacInvalidation(
  event: Omit<RbacInvalidationEvent, "ts">,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    redisUnavailableCounter.inc();
    logger.warn(
      "Redis unavailable — RBAC invalidation publish skipped; cross-instance caches will not be cleared",
      event,
    );
    return;
  }

  try {
    const payload: RbacInvalidationEvent = { ...event, ts: new Date().toISOString() };
    await client.publish(CHANNEL, JSON.stringify(payload));
    logger.debug("RBAC invalidation published", payload);
  } catch (err) {
    logger.error("Failed to publish RBAC invalidation", err instanceof Error ? err : undefined, event);
  }
}

/**
 * Subscribe to RBAC invalidation events on a dedicated Redis connection.
 * Calls `onInvalidate` for each received event.
 *
 * Returns an unsubscribe function. Call it on graceful shutdown.
 */
export async function subscribeRbacInvalidation(
  onInvalidate: (event: RbacInvalidationEvent) => void,
): Promise<() => Promise<void>> {
  const client = await getRedisClient();
  if (!client) {
    redisUnavailableCounter.inc();
    logger.error(
      "Redis unavailable — RBAC invalidation subscription skipped; this instance will not receive cross-instance cache invalidations (degraded-security mode)",
    );
    return async () => {};
  }

  // Redis pub/sub requires a dedicated connection — duplicate the client.
  const subscriber = client.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(CHANNEL, (message) => {
    try {
      const event = JSON.parse(message) as RbacInvalidationEvent;
      onInvalidate(event);
    } catch (err) {
      logger.error("Failed to parse RBAC invalidation message", err instanceof Error ? err : undefined);
    }
  });

  logger.info("RBAC invalidation subscription active", { channel: CHANNEL });

  return async () => {
    try {
      await subscriber.unsubscribe(CHANNEL);
      await subscriber.disconnect();
    } catch (err) {
      logger.error("Failed to unsubscribe RBAC invalidation", err instanceof Error ? err : undefined);
    }
  };
}
