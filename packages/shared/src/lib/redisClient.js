import { createClient } from 'redis';
import { createLogger } from './logger';
const logger = createLogger({ component: 'redis-client' });
let client = null;
let connecting = null;
export async function getRedisClient() {
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
            return client;
        })
            .catch((error) => {
            logger.error('Failed to connect to Redis', error);
            connecting = null;
            throw error;
        });
    }
    return connecting;
}
//# sourceMappingURL=redisClient.js.map