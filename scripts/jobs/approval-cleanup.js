#!/usr/bin/env node

/**
 * Approval Cleanup Cron Job
 * Expires stale pending approvals and cleans up completed approval records.
 *
 * Usage: node scripts/jobs/approval-cleanup.js [--expire-days=7] [--retain-days=90]
 * Schedule: Daily at 4 AM
 *
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Parse CLI arguments
const args = process.argv.slice(2);
const expireDaysArg = args.find(arg => arg.startsWith('--expire-days='));
const retainDaysArg = args.find(arg => arg.startsWith('--retain-days='));
const EXPIRE_DAYS = expireDaysArg ? parseInt(expireDaysArg.split('=')[1], 10) : 7;
const RETAIN_DAYS = retainDaysArg ? parseInt(retainDaysArg.split('=')[1], 10) : 90;

const requiredEnvVars = [
  'DATABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

let createClient;

try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (error) {
  console.error('Failed to load dependencies. Make sure the project is built.');
  console.error('   Run: pnpm run build');
  console.error('   Error:', error.message);
  process.exit(1);
}

const JOB_NAME = 'approval-cleanup';

function log(level, message, meta = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    job: JOB_NAME,
    message,
    ...meta,
  }));
}

async function run() {
  const startTime = Date.now();

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    log('info', 'Starting approval cleanup', { EXPIRE_DAYS, RETAIN_DAYS });

    // 1. Expire stale pending approvals
    const expireCutoff = new Date();
    expireCutoff.setDate(expireCutoff.getDate() - EXPIRE_DAYS);

    const { data: expired, error: expireError } = await supabase
      .from('approval_requests')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
        resolution_note: `Auto-expired after ${EXPIRE_DAYS} days without action`,
      })
      .eq('status', 'pending')
      .lte('created_at', expireCutoff.toISOString())
      .select('id, organization_id');

    if (expireError) {
      throw new Error(`Failed to expire approvals: ${expireError.message}`);
    }

    const expiredCount = expired?.length || 0;
    log('info', `Expired ${expiredCount} stale pending approvals`);

    // 2. Log audit entries for expired approvals
    if (expired && expired.length > 0) {
      const auditEntries = expired.map(approval => ({
        organization_id: approval.organization_id,
        action: 'approval.auto_expired',
        resource_type: 'approval_request',
        resource_id: approval.id,
        actor: 'system:approval-cleanup',
        details: { reason: 'stale_pending', expire_days: EXPIRE_DAYS },
        created_at: new Date().toISOString(),
      }));

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditEntries);

      if (auditError) {
        log('warn', `Failed to write audit logs: ${auditError.message}`);
      }
    }

    // 3. Delete old completed/expired/rejected approvals beyond retention
    const retainCutoff = new Date();
    retainCutoff.setDate(retainCutoff.getDate() - RETAIN_DAYS);

    const { data: deleted, error: deleteError } = await supabase
      .from('approval_requests')
      .delete()
      .in('status', ['approved', 'rejected', 'expired'])
      .lte('updated_at', retainCutoff.toISOString())
      .select('id');

    if (deleteError) {
      throw new Error(`Failed to delete old approvals: ${deleteError.message}`);
    }

    const deletedCount = deleted?.length || 0;
    log('info', `Deleted ${deletedCount} old approval records (>${RETAIN_DAYS} days)`);

    // 4. Clean up orphaned approval attachments
    const { data: orphaned, error: orphanError } = await supabase
      .from('approval_attachments')
      .delete()
      .is('approval_request_id', null)
      .select('id');

    const orphanedCount = orphaned?.length || 0;
    if (orphanError) {
      log('warn', `Failed to clean orphaned attachments: ${orphanError.message}`);
    }

    const duration = Date.now() - startTime;

    log('info', 'Approval cleanup completed', {
      status: 'success',
      expired: expiredCount,
      deleted: deletedCount,
      orphaned_attachments: orphanedCount,
      duration_ms: duration,
    });

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;

    log('error', 'Approval cleanup failed', {
      status: 'error',
      error: error.message,
      stack: error.stack,
      duration_ms: duration,
    });

    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

if (require.main === module) {
  run();
}

module.exports = { run };
