/**
 * Usage Events API
 * Contract-first ingestion API for usage events with idempotency
 */

import express, { Request, Response } from "express";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../../lib/logger.js";
import { requestSanitizationMiddleware } from "../../middleware/requestSanitizationMiddleware.js";
import { createRequestSupabaseClient } from "../../lib/supabase.js";

const router = express.Router();
const logger = createLogger({ component: "UsageEventsAPI" });

function getClientFromReq(req: Request): SupabaseClient {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing authorization header");
  }
  const token = authHeader.slice(7).trim();
  return createRequestSupabaseClient(token);
}

// Request sanitization
router.use(
  requestSanitizationMiddleware({
    body: {
      event_id: { maxLength: 128 },
      event_type: { maxLength: 128 },
      tenant_id: { maxLength: 128 },
      meter_name: { maxLength: 128 },
      quantity: { maxLength: 32 },
      idempotency_key: { maxLength: 256 },
      event_time: { maxLength: 32 },
      dimensions: { maxLength: 10000 }, // JSON
      metadata: { maxLength: 10000 }, // JSON
    },
  })
);

interface UsageEventRequest {
  event_id: string;
  event_type: string;
  tenant_id: string;
  meter_name: string;
  quantity: number;
  idempotency_key: string;
  event_time: string;
  dimensions?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/billing/v1/usage/events
 * Ingest usage event with idempotency
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Extract tenant from auth context (assuming middleware sets this)
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized - no tenant context" });
    }

    let supabase: SupabaseClient;
    try {
      supabase = getClientFromReq(req);
    } catch {
      return res.status(503).json({ error: "Billing service not configured" });
    }

    const event: UsageEventRequest = req.body;

    // Validate required fields
    if (!event.event_id || !event.event_type || !event.meter_name || !event.idempotency_key) {
      return res.status(400).json({
        error: "Missing required fields: event_id, event_type, meter_name, idempotency_key"
      });
    }

    // Validate quantity is positive
    if (typeof event.quantity !== "number" || event.quantity < 0) {
      return res.status(400).json({ error: "quantity must be a non-negative number" });
    }

    // Validate event_time is ISO string and not in future
    const eventTime = new Date(event.event_time);
    if (isNaN(eventTime.getTime())) {
      return res.status(400).json({ error: "event_time must be a valid ISO date string" });
    }
    if (eventTime > new Date()) {
      return res.status(400).json({ error: "event_time cannot be in the future" });
    }

    // Check if event already exists (idempotency)
    const { data: existingEvent } = await supabase
      .from("usage_events")
      .select("id, event_id")
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", event.idempotency_key)
      .single();

    if (existingEvent) {
      logger.info("Usage event already exists (idempotent)", {
        tenantId,
        eventId: event.event_id,
        idempotencyKey: event.idempotency_key,
      });
      return res.status(200).json({
        status: "accepted",
        event_id: existingEvent.event_id,
        message: "Event already processed"
      });
    }

    // Validate meter exists
    const { data: meter } = await supabase
      .from("billing_meters")
      .select("meter_key")
      .eq("meter_key", event.meter_name)
      .single();

    if (!meter) {
      return res.status(400).json({
        error: `Unknown meter: ${event.meter_name}`
      });
    }

    // Insert usage event
    const { data: insertedEvent, error } = await supabase
      .from("usage_events")
      .insert({
        tenant_id: tenantId,
        metric: event.meter_name,
        amount: event.quantity,
        event_id: event.event_id,
        event_type: event.event_type,
        idempotency_key: event.idempotency_key,
        event_time: eventTime.toISOString(),
        ingested_at: new Date().toISOString(),
        dimensions: event.dimensions || {},
        metadata: event.metadata || {},
      })
      .select("id, event_id")
      .single();

    if (error) {
      logger.error("Error inserting usage event", error, { tenantId, eventId: event.event_id });
      return res.status(500).json({ error: "Failed to ingest usage event" });
    }

    logger.info("Usage event ingested successfully", {
      tenantId,
      eventId: event.event_id,
      meterName: event.meter_name,
      quantity: event.quantity,
    });

    return res.status(201).json({
      status: "ingested",
      event_id: insertedEvent.event_id,
      ingested_id: insertedEvent.id,
    });

  } catch (error) {
    logger.error("Unexpected error in usage events API", error as Error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/billing/v1/usage/events/batch
 * Batch ingest multiple usage events
 */
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized - no tenant context" });
    }

    let supabase: SupabaseClient;
    try {
      supabase = getClientFromReq(req);
    } catch {
      return res.status(503).json({ error: "Billing service not configured" });
    }

    const { events }: { events: UsageEventRequest[] } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events must be a non-empty array" });
    }

    if (events.length > 1000) {
      return res.status(400).json({ error: "Maximum 1000 events per batch" });
    }

    const results = [];
    let ingested = 0;
    let duplicates = 0;

    for (const event of events) {
      try {
        // Reuse single event logic but capture response
        const mockReq = { body: event, tenantId } as any;
        let result: any = null;

        // Check idempotency
        const { data: existingEvent } = await supabase
          .from("usage_events")
          .select("id, event_id")
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", event.idempotency_key)
          .single();

        if (existingEvent) {
          result = {
            status: "accepted",
            event_id: existingEvent.event_id,
            message: "Event already processed"
          };
          duplicates++;
        } else {
          // Validate and insert
          const eventTime = new Date(event.event_time);
          const { data: insertedEvent, error } = await supabase
            .from("usage_events")
            .insert({
              tenant_id: tenantId,
              metric: event.meter_name,
              amount: event.quantity,
              event_id: event.event_id,
              event_type: event.event_type,
              idempotency_key: event.idempotency_key,
              event_time: eventTime.toISOString(),
              ingested_at: new Date().toISOString(),
              dimensions: event.dimensions || {},
              metadata: event.metadata || {},
            })
            .select("id, event_id")
            .single();

          if (error) throw error;

          result = {
            status: "ingested",
            event_id: insertedEvent.event_id,
            ingested_id: insertedEvent.id,
          };
          ingested++;
        }

        results.push({
          event_id: event.event_id,
          ...result,
        });

      } catch (error) {
        results.push({
          event_id: event.event_id,
          status: "error",
          error: (error as Error).message,
        });
      }
    }

    logger.info("Batch usage events processed", {
      tenantId,
      totalEvents: events.length,
      ingested,
      duplicates,
      errors: events.length - ingested - duplicates,
    });

    return res.status(200).json({
      status: "batch_processed",
      total_events: events.length,
      ingested,
      duplicates,
      errors: events.length - ingested - duplicates,
      results,
    });

  } catch (error) {
    logger.error("Unexpected error in batch usage events API", error as Error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
