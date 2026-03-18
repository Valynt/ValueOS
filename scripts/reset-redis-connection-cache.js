#!/usr/bin/env node

/**
 * Reset Redis Connection Cache
 *
 * This script resets Redis connection caches across the application.
 * It handles:
 * 1. Redis client reconnection
 * 2. Cache invalidation
 * 3. Connection pool reset
 *
 * Usage: node scripts/reset-redis-connection-cache.js [options]
 *
 * Options:
 *   --force          Force reset even if Redis is healthy
 *   --soft           Only reset connection pools, keep cached data
 *   --hard           Full reset including all cached data
 *   --dry-run        Show what would be reset without doing it
 */

const { createClient } = require('redis');
const { Redis } = require('ioredis');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisConnectionReset {
  constructor(options = {}) {
    this.options = {
      force: options.force || false,
      soft: options.soft || false,
      hard: options.hard || false,
      dryRun: options.dryRun || false,
      ...options
    };

    this.results = {
      connectionsReset: 0,
      cachesCleared: 0,
      errors: []
    };
  }

  async checkRedisHealth() {
    try {
      const client = createClient({ url: REDIS_URL });
      await client.connect();

      const pingResult = await client.ping();
      await client.disconnect();

      return pingResult === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error.message);
      return false;
    }
  }

  async resetIORedisConnections() {
    try {
      // Reset shared Redis client from packages/shared/src/lib/redisClient.ts
      console.log('Resetting IORedis connections...');

      if (this.options.dryRun) {
        console.log('[DRY RUN] Would reset IORedis client cache');
        this.results.connectionsReset++;
        return;
      }

      // Clear require cache to force module re-evaluation
      const redisClientPath = path.resolve(process.cwd(), 'packages/shared/src/lib/redisClient.js');
      if (require.cache[redisClientPath]) {
        delete require.cache[redisClientPath];
        console.log('Cleared IORedis client module cache');
        this.results.connectionsReset++;
      }

      // Try to get current client and disconnect if exists
      try {
        const redisModule = require(redisClientPath);
        if (redisModule.getRedisClient) {
          const client = redisModule.getRedisClient();
          if (client && typeof client.disconnect === 'function') {
            await client.disconnect();
            console.log('Disconnected existing IORedis client');
          }
        }
      } catch (error) {
        console.log('No existing IORedis client to disconnect');
      }

    } catch (error) {
      this.results.errors.push(`IORedis reset failed: ${error.message}`);
    }
  }

  async resetRedisConnections() {
    try {
      console.log('Resetting Redis connections...');

      if (this.options.dryRun) {
        console.log('[DRY RUN] Would reset Redis client connections');
        this.results.connectionsReset++;
        return;
      }

      const client = createClient({ url: REDIS_URL });

      client.on('error', (err) => {
        console.error('Redis client error during reset:', err);
      });

      await client.connect();

      // Reset connection pool by disconnecting and reconnecting
      await client.disconnect();

      // Reconnect to ensure clean state
      await client.connect();
      const pingResult = await client.ping();

      if (pingResult === 'PONG') {
        console.log('Redis connection reset successful');
        this.results.connectionsReset++;
      }

      await client.disconnect();

    } catch (error) {
      this.results.errors.push(`Redis connection reset failed: ${error.message}`);
    }
  }

  async clearApplicationCaches() {
    if (this.options.soft) {
      console.log('Skipping cache clearing (soft reset mode)');
      return;
    }

    try {
      console.log('Clearing application caches...');

      if (this.options.dryRun) {
        console.log('[DRY RUN] Would clear Redis caches');
        this.results.cachesCleared++;
        return;
      }

      const client = createClient({ url: REDIS_URL });
      await client.connect();

      // Clear common cache patterns
      const cachePatterns = [
        'cache:*',
        'llm:cache:*',
        'agent:*',
        'workflow:*',
        'tenant:*',
        'config:*',
        'secret:*'
      ];

      let totalDeleted = 0;

      for (const pattern of cachePatterns) {
        try {
          const keys = await client.keys(pattern);
          if (keys.length > 0) {
            const deleted = await client.del(keys);
            totalDeleted += deleted;
            console.log(`Cleared ${deleted} keys matching ${pattern}`);
          }
        } catch (error) {
          console.warn(`Failed to clear pattern ${pattern}:`, error.message);
        }
      }

      // Clear all keys if hard reset
      if (this.options.hard) {
        console.log('Performing hard reset - clearing all Redis data...');
        await client.flushAll();
        console.log('All Redis data cleared');
        totalDeleted = 'all';
      }

      this.results.cachesCleared = totalDeleted;
      await client.disconnect();

    } catch (error) {
      this.results.errors.push(`Cache clearing failed: ${error.message}`);
    }
  }

  async resetMemoryCaches() {
    try {
      console.log('Resetting in-memory caches...');

      if (this.options.dryRun) {
        console.log('[DRY RUN] Would reset in-memory caches');
        return;
      }

      // Clear Node.js require cache for cache-related modules
      const cacheModules = [
        'packages/backend/src/services/cache/',
        'packages/backend/src/services/metering/UsageCache.js',
        'packages/backend/src/services/ground-truth/GroundTruthCache.js',
        'packages/shared/src/lib/cache/'
      ];

      for (const modulePath of cacheModules) {
        const fullPath = path.resolve(process.cwd(), modulePath);
        for (const [cachedPath, cachedModule] of Object.entries(require.cache)) {
          if (cachedPath.includes(modulePath) || cachedPath.includes(fullPath)) {
            delete require.cache[cachedPath];
            console.log(`Cleared module cache: ${cachedPath}`);
          }
        }
      }

    } catch (error) {
      this.results.errors.push(`Memory cache reset failed: ${error.message}`);
    }
  }

  async run() {
    console.log('🔄 Starting Redis connection cache reset...');
    console.log(`Redis URL: ${REDIS_URL}`);
    console.log(`Options: ${JSON.stringify(this.options, null, 2)}`);
    console.log('');

    try {
      // Check Redis health first
      const isHealthy = await this.checkRedisHealth();

      if (!isHealthy && !this.options.force) {
        console.error('❌ Redis is not healthy. Use --force to reset anyway.');
        return false;
      }

      if (isHealthy) {
        console.log('✅ Redis health check passed');
      } else {
        console.log('⚠️  Redis is unhealthy (proceeding with reset)');
      }

      console.log('');

      // Execute reset operations
      await this.resetIORedisConnections();
      await this.resetRedisConnections();
      await this.clearApplicationCaches();
      await this.resetMemoryCaches();

      // Print results
      console.log('');
      console.log('📊 Reset Results:');
      console.log(`  Connections reset: ${this.results.connectionsReset}`);
      console.log(`  Caches cleared: ${this.results.cachesCleared}`);

      if (this.results.errors.length > 0) {
        console.log('  Errors:');
        this.results.errors.forEach(error => console.log(`    - ${error}`));
      }

      const success = this.results.errors.length === 0;
      console.log('');
      console.log(success ? '✅ Redis connection cache reset completed successfully' : '⚠️  Reset completed with some errors');

      return success;

    } catch (error) {
      console.error('❌ Redis connection cache reset failed:', error.message);
      return false;
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--force':
        options.force = true;
        break;
      case '--soft':
        options.soft = true;
        break;
      case '--hard':
        options.hard = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Redis Connection Cache Reset Tool

Usage: node scripts/reset-redis-connection-cache.js [options]

Options:
  --force          Force reset even if Redis is healthy
  --soft           Only reset connection pools, keep cached data
  --hard           Full reset including all cached data
  --dry-run        Show what would be reset without doing it
  --help           Show this help message

Examples:
  node scripts/reset-redis-connection-cache.js
  node scripts/reset-redis-connection-cache.js --force --hard
  node scripts/reset-redis-connection-cache.js --soft --dry-run
`);
        process.exit(0);
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();
  const resetter = new RedisConnectionReset(options);

  const success = await resetter.run();
  process.exit(success ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { RedisConnectionReset };
