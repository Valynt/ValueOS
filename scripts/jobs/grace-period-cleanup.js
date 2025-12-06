#!/usr/bin/env node

/**
 * Grace Period Cleanup Cron Job
 * Removes old grace period records from the database
 * 
 * Usage: node scripts/jobs/grace-period-cleanup.js [--days=30]
 * Schedule: Daily at 3 AM
 * 
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const daysOld = daysArg ? parseInt(daysArg.split('=')[1]) : 30;

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Import services
let GracePeriodService;
let createLogger;

try {
  GracePeriodService = require('../../dist/services/metering/GracePeriodService').default;
  createLogger = require('../../dist/lib/logger').createLogger;
} catch (error) {
  console.error('❌ Failed to load services. Make sure the project is built.');
  console.error('   Run: npm run build');
  console.error('   Error:', error.message);
  process.exit(1);
}

const logger = createLogger({ component: 'GracePeriodCleanupCron' });

/**
 * Main execution function
 */
async function run() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting grace period cleanup job', { daysOld });
    
    // Clean up old grace periods
    const count = await GracePeriodService.cleanupOldGracePeriods(daysOld);
    
    const duration = Date.now() - startTime;
    
    logger.info('Grace period cleanup completed', {
      cleaned: count,
      daysOld,
      duration: `${duration}ms`,
    });
    
    // Log summary to stdout
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      job: 'grace-period-cleanup',
      status: 'success',
      cleaned: count,
      daysOld,
      duration,
    }));
    
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Grace period cleanup failed', error, { duration: `${duration}ms` });
    
    // Log error to stdout
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      job: 'grace-period-cleanup',
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
