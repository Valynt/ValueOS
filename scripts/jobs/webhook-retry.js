#!/usr/bin/env node

/**
 * Webhook Retry Cron Job
 * Processes failed webhook events with exponential backoff
 * 
 * Usage: node scripts/jobs/webhook-retry.js
 * Schedule: Every 5 minutes
 * 
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 * - STRIPE_SECRET_KEY: Stripe API secret key
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Import services (after env vars are loaded)
let WebhookRetryService;
let createLogger;

try {
  WebhookRetryService = require('../../dist/services/billing/WebhookRetryService').default;
  createLogger = require('../../dist/lib/logger').createLogger;
} catch (error) {
  console.error('❌ Failed to load services. Make sure the project is built.');
  console.error('   Run: npm run build');
  console.error('   Error:', error.message);
  process.exit(1);
}

const logger = createLogger({ component: 'WebhookRetryCron' });

/**
 * Main execution function
 */
async function run() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting webhook retry job');
    
    // Process retries
    const result = await WebhookRetryService.processRetries();
    
    const duration = Date.now() - startTime;
    
    logger.info('Webhook retry job completed', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      duration: `${duration}ms`,
    });
    
    // Log summary to stdout for cron monitoring
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      job: 'webhook-retry',
      status: 'success',
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      duration,
    }));
    
    // Exit with error if any retries failed
    if (result.failed > 0) {
      logger.warn('Some webhook retries failed', { failed: result.failed });
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Webhook retry job failed', error, { duration: `${duration}ms` });
    
    // Log error to stdout for cron monitoring
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      job: 'webhook-retry',
      status: 'error',
      error: error.message,
      stack: error.stack,
      duration,
    }));
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { run };
