import { createClient, RedisClientType } from 'redis';
import { createLogger } from './logger';

const logger = createLogger({ component: 'redis-client' });

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  if (!connecting) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
      logger.error('Redis client error', err);
      connecting = null;
    });

    connecting = client
      .connect()
      .then(() => {
        logger.info('Redis client connected');
        return client as RedisClientType;
      })
      .catch((error) => {
        logger.error('Failed to connect to Redis', error as Error);
        connecting = null;
        throw error;
      });
  }

  return connecting;
}
