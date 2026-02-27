#!/usr/bin/env node

/**
 * Usage Aggregation Cron Job
 * Aggregates raw usage records into period summaries and submits to Stripe.
 *
 * Usage: node scripts/jobs/usage-aggregation.js
 * Schedule: Every 5 minutes
 *
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 * - STRIPE_SECRET_KEY: Stripe API secret key
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'DATABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

let createClient;
let Stripe;

try {
  createClient = require('@supabase/supabase-js').createClient;
  Stripe = require('stripe').default || require('stripe');
} catch (error) {
  console.error('Failed to load dependencies. Make sure the project is built.');
  console.error('   Run: pnpm run build');
  console.error('   Error:', error.message);
  process.exit(1);
}

const JOB_NAME = 'usage-aggregation';
const BATCH_SIZE = 500;
const AGGREGATION_WINDOW_MINUTES = 5;

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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  try {
    log('info', 'Starting usage aggregation');

    // 1. Fetch un-aggregated usage records grouped by tenant + metric
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - AGGREGATION_WINDOW_MINUTES * 60 * 1000);

    const { data: rawRecords, error: fetchError } = await supabase
      .from('usage_records')
      .select('*')
      .eq('aggregated', false)
      .lte('created_at', windowEnd.toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch usage records: ${fetchError.message}`);
    }

    if (!rawRecords || rawRecords.length === 0) {
      log('info', 'No pending usage records to aggregate');
      process.exit(0);
    }

    log('info', `Found ${rawRecords.length} un-aggregated records`);

    // 2. Group by (organization_id, metric, period)
    const groups = new Map();
    for (const record of rawRecords) {
      const periodStart = new Date(record.created_at);
      periodStart.setMinutes(0, 0, 0); // Truncate to hour
      const key = `${record.organization_id}:${record.metric}:${periodStart.toISOString()}`;

      if (!groups.has(key)) {
        groups.set(key, {
          organization_id: record.organization_id,
          metric: record.metric,
          period_start: periodStart.toISOString(),
          period_end: new Date(periodStart.getTime() + 3600000).toISOString(),
          total_amount: 0,
          record_ids: [],
        });
      }

      const group = groups.get(key);
      group.total_amount += record.quantity;
      group.record_ids.push(record.id);
    }

    log('info', `Grouped into ${groups.size} aggregates`);

    // 3. Upsert aggregates and mark records as aggregated
    let aggregated = 0;
    let submitted = 0;

    for (const [, group] of groups) {
      const idempotencyKey = `agg_${group.organization_id}_${group.metric}_${group.period_start}`;

      // Upsert aggregate
      const { error: upsertError } = await supabase
        .from('usage_aggregates')
        .upsert({
          organization_id: group.organization_id,
          metric: group.metric,
          period_start: group.period_start,
          period_end: group.period_end,
          total_amount: group.total_amount,
          idempotency_key: idempotencyKey,
          submitted_to_stripe: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,metric,period_start',
        });

      if (upsertError) {
        log('error', `Failed to upsert aggregate: ${upsertError.message}`, {
          organization_id: group.organization_id,
          metric: group.metric,
        });
        continue;
      }

      // Mark source records as aggregated
      const { error: markError } = await supabase
        .from('usage_records')
        .update({ aggregated: true })
        .in('id', group.record_ids);

      if (markError) {
        log('error', `Failed to mark records as aggregated: ${markError.message}`);
        continue;
      }

      aggregated++;
    }

    // 4. Submit pending aggregates to Stripe
    const { data: pendingAggregates, error: pendingError } = await supabase
      .from('usage_aggregates')
      .select('*')
      .eq('submitted_to_stripe', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!pendingError && pendingAggregates) {
      for (const agg of pendingAggregates) {
        if (!agg.subscription_item_id) {
          continue; // Skip aggregates without Stripe subscription item mapping
        }

        try {
          const usageRecord = await stripe.subscriptionItems.createUsageRecord(
            agg.subscription_item_id,
            {
              quantity: Math.ceil(agg.total_amount),
              timestamp: Math.floor(new Date(agg.period_end).getTime() / 1000),
              action: 'set',
            },
            { idempotencyKey: agg.idempotency_key }
          );

          await supabase
            .from('usage_aggregates')
            .update({
              submitted_to_stripe: true,
              submitted_at: new Date().toISOString(),
              stripe_usage_record_id: usageRecord.id,
            })
            .eq('id', agg.id);

          submitted++;
        } catch (stripeError) {
          log('error', `Stripe submission failed for aggregate ${agg.id}`, {
            error: stripeError.message,
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    log('info', 'Usage aggregation completed', {
      status: 'success',
      records_processed: rawRecords.length,
      aggregates_created: aggregated,
      submitted_to_stripe: submitted,
      duration_ms: duration,
    });

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;

    log('error', 'Usage aggregation failed', {
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
