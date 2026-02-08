#!/usr/bin/env node
// redis-migration-lock.js
// Distributed lock for migration using Redis
const redis = require('redis');
const { promisify } = require('util');

const LOCK_KEY = 'migration_lock';
const LOCK_TTL = 600; // seconds

async function acquireLock(client) {
  const setAsync = promisify(client.set).bind(client);
  // SET key value NX EX TTL
  const result = await setAsync(LOCK_KEY, 'locked', 'NX', 'EX', LOCK_TTL);
  return result === 'OK';
}

async function releaseLock(client) {
  const delAsync = promisify(client.del).bind(client);
  await delAsync(LOCK_KEY);
}

async function main() {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  client.on('error', err => console.error('Redis error:', err));
  await client.connect?.();

  const locked = await acquireLock(client);
  if (!locked) {
    console.error('[Zero-Downtime] Migration lock is already held. Aborting.');
    process.exit(1);
  }
  console.log('[Zero-Downtime] Migration lock acquired.');

  // ... run migration logic here ...

  await releaseLock(client);
  console.log('[Zero-Downtime] Migration lock released.');
  client.quit();
}

if (require.main === module) {
  main();
}
