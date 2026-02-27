"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
const redis_1 = require("redis");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)({ component: 'redis-client' });
let client = null;
let connecting = null;
async function getRedisClient() {
    if (client?.isOpen) {
        return client;
    }
    if (!connecting) {
        client = (0, redis_1.createClient)({
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