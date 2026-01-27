/**
 * Redis Client
 * 
 * Re-exports Redis client from shared package
 */

export { redisClient, getRedisClient, createRedisClient } from '@shared/lib/redisClient';
export { getRedisKey } from '@shared/lib/redisKeys';
