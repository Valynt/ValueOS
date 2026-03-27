/**
 * Webhook DLQ (Dead-Letter Queue) API
 *
 * Provides observability and replay for permanently-failed webhook events.
 * All endpoints require service identity — not accessible to end users.
 *
 * GET  /internal/billing/dlq         — list failed events with count
 * POST /internal/billing/dlq/:id/replay — re-enqueue a failed event
 */

import { createClient } from '@supabase/supabase-js';
import express, { NextFunction, Request, Response } from 'express';

import { createLogger } from '../../lib/logger.js';
import { webhookDlqSize } from '../../metrics/billingMetrics.js';
import { enqueueWebhookRetry } from '../../workers/WebhookRetryWorker.js';

const router = express.Router();
const logger = createLogger({ component: 'DlqApi' });

const PAGE_SIZE = 50;

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, {
    // justification: service-role:justified DLQ management requires reading failed webhook events across all tenants
    auth: { persistSession: false },
  });
}

/**
 * Guard: all DLQ endpoints require verified service identity.
 * This is belt-and-suspenders on top of the billing router's serviceIdentityMiddleware.
 */
function requireServiceIdentity(req: Request, res: Response, next: NextFunction): void {
  const serviceReq = req as Request & { serviceIdentityVerified?: boolean };
  if (!serviceReq.serviceIdentityVerified) {
    res.status(403).json({ error: 'Forbidden', message: 'Service identity required' });
    return;
  }
  next();
}

/**
 * GET /internal/billing/dlq
 *
 * Returns the count and first PAGE_SIZE failed webhook events.
 * Query params:
 *   - page: number (default 1)
 *   - tenant_id: string (optional filter)
 */
router.get('/', requireServiceIdentity, async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getServiceSupabase();
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const tenantId = req.query['tenant_id'] as string | undefined;
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('webhook_events')
      .select('id, stripe_event_id, event_type, tenant_id, status, error_message, retry_count, failed_at, received_at', { count: 'exact' })
      .eq('status', 'failed')
      .order('failed_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error('DLQ list query failed', error);
      res.status(500).json({ error: 'Failed to fetch DLQ' });
      return;
    }

    // Update the gauge to reflect current DLQ depth
    if (count !== null) {
      webhookDlqSize.set(count);
    }

    res.json({
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
      events: data ?? [],
    });
  } catch (err) {
    logger.error('DLQ list error', err as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /internal/billing/dlq/:id/replay
 *
 * Re-enqueues a failed webhook event for reprocessing.
 * Resets status to 'pending' and increments retry_count.
 */
router.post('/:id/replay', requireServiceIdentity, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid event ID' });
    return;
  }

  try {
    const supabase = getServiceSupabase();

    // Fetch the event to replay
    const { data: event, error: fetchError } = await supabase
      .from('webhook_events')
      .select('id, stripe_event_id, event_type, tenant_id, payload, retry_count, status')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (event.status !== 'failed') {
      res.status(409).json({
        error: 'Conflict',
        message: `Event is in status '${event.status as string}', not 'failed'. Only failed events can be replayed.`,
      });
      return;
    }

    // Reset status to pending before re-enqueue
    const { error: updateError } = await supabase
      .from('webhook_events')
      .update({
        status: 'pending',
        error_message: null,
        failed_at: null,
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to reset event status for replay', updateError, { eventId: id });
      res.status(500).json({ error: 'Failed to reset event status' });
      return;
    }

    // Re-enqueue into the BullMQ retry queue
    await enqueueWebhookRetry({
      eventId: event.stripe_event_id as string,
      tenantId: (event.tenant_id as string) ?? '',
      eventType: event.event_type as string,
      payload: (event.payload as Record<string, unknown>) ?? {},
      attemptNumber: 1,
    });

    // Decrement DLQ gauge
    webhookDlqSize.dec();

    logger.info('Webhook event replayed', {
      eventId: id,
      stripeEventId: event.stripe_event_id,
      eventType: event.event_type,
      tenantId: event.tenant_id,
    });

    res.json({
      replayed: true,
      event_id: id,
      stripe_event_id: event.stripe_event_id,
    });
  } catch (err) {
    logger.error('DLQ replay error', err as Error, { eventId: id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
