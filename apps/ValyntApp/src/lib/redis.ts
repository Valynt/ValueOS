import { getRedisClient } from "./redisClient";
import { logger } from "./logger";

/**
 * Initialize Redis cache initialization for bootstrap sequence
 */
export async function initializeRedisCache(config: { enabled?: boolean; url?: string } = {}) {
  if (!config.enabled) {
    return { connected: false, message: "Cache disabled" };
  }

  const startTime = Date.now();
  try {
    const client = await getRedisClient();
    return {
      connected: client.isOpen,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    logger.error("Redis initialization failed", { error });
    return {
      connected: false,
      error,
      latency: Date.now() - startTime,
    };
  }
}

export * from "./redisClient";
export * from "./redisKeys";
