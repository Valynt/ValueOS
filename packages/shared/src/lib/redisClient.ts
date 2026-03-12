import { Redis } from 'ioredis';

import { createLogger } from './logger.js';

const logger = createLogger({ component: 'redis-client' });

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

    client.on('error', (err: Error) => {
      logger.error('Redis client error', err);
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  return client;
}
