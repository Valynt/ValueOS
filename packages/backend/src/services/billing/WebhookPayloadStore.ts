/**
 * WebhookPayloadStore
 *
 * Durable storage for Stripe webhook raw payloads.
 *
 * Strategy:
 *   - Payloads ≤ INLINE_THRESHOLD_BYTES: stored inline in webhook_events.raw_payload
 *   - Payloads > INLINE_THRESHOLD_BYTES: stored in Supabase Storage bucket
 *     'webhook-payloads' at path {stripe_event_id}; DB stores the object path
 *     in webhook_events.payload_ref
 *
 * The bucket must exist and have service_role-only RLS (no public access).
 * Bucket creation is handled by the Supabase project setup, not this code.
 *
 * justification: service-role:justified webhook payload archival requires
 * writing raw Stripe event data outside the tenant request context
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'WebhookPayloadStore' });

/** Payloads larger than this are stored in Supabase Storage instead of inline. */
export const INLINE_THRESHOLD_BYTES = 256 * 1024; // 256 KB

export const WEBHOOK_PAYLOADS_BUCKET = 'webhook-payloads';

export type PayloadStorageResult =
  | { mode: 'inline'; rawPayload: unknown; payloadRef: null }
  | { mode: 'external'; rawPayload: null; payloadRef: string };

function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for WebhookPayloadStore');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Store a webhook payload, choosing inline vs. external based on size.
 *
 * @param stripeEventId  The Stripe event ID (used as the storage object name)
 * @param payload        The raw Stripe event object
 * @returns              Storage result indicating where the payload was stored
 */
export async function storeWebhookPayload(
  stripeEventId: string,
  payload: unknown,
): Promise<PayloadStorageResult> {
  const serialized = JSON.stringify(payload);
  const byteLength = Buffer.byteLength(serialized, 'utf8');

  if (byteLength <= INLINE_THRESHOLD_BYTES) {
    return { mode: 'inline', rawPayload: payload, payloadRef: null };
  }

  // Payload exceeds threshold — store in Supabase Storage
  logger.info('Webhook payload exceeds inline threshold — storing externally', {
    stripeEventId,
    byteLength,
    threshold: INLINE_THRESHOLD_BYTES,
  });

  const supabase = getServiceSupabase();
  const objectPath = stripeEventId; // e.g. evt_1ABC...

  const { error: uploadError } = await supabase.storage
    .from(WEBHOOK_PAYLOADS_BUCKET)
    .upload(objectPath, Buffer.from(serialized, 'utf8'), {
      contentType: 'application/json',
      upsert: true, // idempotent — safe to re-upload on retry
    });

  if (uploadError) {
    logger.error('Failed to upload oversized webhook payload to storage', {
      stripeEventId,
      byteLength,
      error: uploadError.message,
    });
    // Fall back to inline storage rather than dropping the event
    logger.warn('Falling back to inline storage for oversized payload', { stripeEventId });
    return { mode: 'inline', rawPayload: payload, payloadRef: null };
  }

  const payloadRef = `${WEBHOOK_PAYLOADS_BUCKET}/${objectPath}`;
  logger.info('Webhook payload stored externally', { stripeEventId, payloadRef, byteLength });

  return { mode: 'external', rawPayload: null, payloadRef };
}

/**
 * Retrieve a webhook payload from storage.
 * Returns the parsed payload regardless of where it was stored.
 *
 * @param rawPayload  Inline payload (from webhook_events.raw_payload), or null
 * @param payloadRef  Storage object path (from webhook_events.payload_ref), or null
 */
export async function retrieveWebhookPayload(
  rawPayload: unknown | null,
  payloadRef: string | null,
): Promise<unknown> {
  if (rawPayload !== null && rawPayload !== undefined) {
    return rawPayload;
  }

  if (!payloadRef) {
    throw new Error('Neither raw_payload nor payload_ref is set — cannot retrieve webhook payload');
  }

  // payloadRef format: "webhook-payloads/{stripe_event_id}"
  const slashIdx = payloadRef.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(`Invalid payload_ref format: ${payloadRef}`);
  }
  const bucket = payloadRef.slice(0, slashIdx);
  const objectPath = payloadRef.slice(slashIdx + 1);

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);

  if (error || !data) {
    throw new Error(`Failed to retrieve webhook payload from storage: ${error?.message ?? 'no data'}`);
  }

  const text = await data.text();
  return JSON.parse(text) as unknown;
}
