/**
 * Redis Client
 * 
 * Re-exports Redis client from shared package
 */

export { getRedisClient } from "@shared/lib/redisClient";
export type { RedisClientRole } from "@shared/lib/redisClient";
export { getRedisKey } from "@shared/lib/redisKeys";
