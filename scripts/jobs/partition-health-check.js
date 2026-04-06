#!/usr/bin/env node
/**
 * Partition Health Check Job
 *
 * Verifies that next month's partitions exist for all high-volume partitioned
 * tables. Runs daily; alerts via Slack when a partition is missing within 5
 * days of the month turning over (i.e. on or after the 25th of the month).
 *
 * Usage:   node scripts/jobs/partition-health-check.js
 * Schedule: Daily at 09:00 UTC (add to cron or pg_cron caller)
 *
 * Environment Variables:
 *   VITE_SUPABASE_URL          Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase service role key
 *   SLACK_WEBHOOK_URL          Slack incoming webhook URL for alerts (optional)
 *   PARTITION_ALERT_THRESHOLD  Day-of-month to start alerting (default: 25)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ── Configuration ────────────────────────────────────────────────────────────

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error('[partition-health-check] Missing required env vars:', missing.join(', '));
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const ALERT_THRESHOLD_DAY = parseInt(process.env.PARTITION_ALERT_THRESHOLD ?? '25', 10);

// ── Supabase client ───────────────────────────────────────────────────────────

let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch {
  console.error('[partition-health-check] @supabase/supabase-js not available');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Alert helpers ─────────────────────────────────────────────────────────────

async function sendSlackAlert(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[partition-health-check] SLACK_WEBHOOK_URL not set — alert not sent');
    return;
  }
  try {
    const https = require('https');
    const body = JSON.stringify({ text: message });
    const url = new URL(SLACK_WEBHOOK_URL);
    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          res.resume();
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Slack webhook returned HTTP ${res.statusCode}`));
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    console.log('[partition-health-check] Slack alert sent');
  } catch (err) {
    console.error('[partition-health-check] Failed to send Slack alert:', err.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const nextMonthLabel = nextMonth.toISOString().slice(0, 7); // YYYY-MM

  console.log(
    `[partition-health-check] Running check — today is the ${dayOfMonth}th, ` +
    `alert threshold is the ${ALERT_THRESHOLD_DAY}th`,
  );

  // Query partition health via the DB function
  const { data: rows, error } = await supabase.rpc('check_partition_health');

  if (error) {
    const msg =
      `⚠️ *Partition Health Check FAILED* — could not query check_partition_health().\n` +
      `Error: ${error.message}\n` +
      `Action required: investigate Supabase connectivity and pg_cron status.`;
    console.error('[partition-health-check]', msg);
    await sendSlackAlert(msg);
    process.exit(1);
  }

  const missing = (rows ?? []).filter((r) => !r.partition_exists);
  const failures = (rows ?? []).filter((r) => r.last_failure_at);

  // Log full status
  for (const row of rows ?? []) {
    const status = row.partition_exists ? '✅' : '❌';
    console.log(
      `[partition-health-check] ${status} ${row.parent_table} → ` +
      `${row.partition_name} (${row.next_month})` +
      (row.last_failure_msg ? ` | last failure: ${row.last_failure_msg}` : ''),
    );
  }

  // Alert if within the alert window and partitions are missing
  const inAlertWindow = dayOfMonth >= ALERT_THRESHOLD_DAY;

  if (missing.length > 0 && inAlertWindow) {
    const tableList = missing.map((r) => `• \`${r.parent_table}\` → \`${r.partition_name}\``).join('\n');
    const failureDetails = failures.length > 0
      ? '\n\n*Recent pg_cron failures:*\n' +
        failures.map((r) => `• \`${r.parent_table}\`: ${r.last_failure_msg ?? 'unknown'} (${r.last_failure_at})`).join('\n')
      : '';

    const alertMsg =
      `🚨 *Partition Alert — ${nextMonthLabel} partitions missing*\n\n` +
      `The following partitions for *${nextMonthLabel}* do not exist and the month ` +
      `turns over in ${31 - dayOfMonth} days or fewer:\n\n` +
      tableList +
      failureDetails +
      `\n\n*Action required:* Run \`SELECT public.create_next_monthly_partitions();\` ` +
      `in Supabase SQL editor and verify the pg_cron job is active.`;

    console.error('[partition-health-check] ALERT:', alertMsg);
    await sendSlackAlert(alertMsg);
    process.exit(1);
  }

  if (missing.length > 0 && !inAlertWindow) {
    console.warn(
      `[partition-health-check] ${missing.length} partition(s) missing for ${nextMonthLabel} ` +
      `but alert threshold (day ${ALERT_THRESHOLD_DAY}) not yet reached — monitoring only`,
    );
  }

  if (failures.length > 0) {
    const failMsg =
      `⚠️ *Partition Creation Failures Detected*\n\n` +
      `pg_cron has logged failures for the following tables:\n` +
      failures.map((r) => `• \`${r.parent_table}\`: ${r.last_failure_msg ?? 'unknown'} (${r.last_failure_at})`).join('\n') +
      `\n\nPartitions currently exist but failures indicate the cron job is unstable.`;
    console.warn('[partition-health-check] Failures logged:', failMsg);
    if (inAlertWindow) {
      await sendSlackAlert(failMsg);
    }
  }

  console.log('[partition-health-check] Check complete — all partitions healthy');
}

main().catch((err) => {
  console.error('[partition-health-check] Unhandled error:', err);
  process.exit(1);
});
