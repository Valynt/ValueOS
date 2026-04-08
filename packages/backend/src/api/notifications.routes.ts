/**
 * Smart Notification Center - Backend
 *
 * GET /api/notifications/stream - SSE endpoint for real-time notifications
 * GET /api/notifications - Fetch notification history
 * POST /api/notifications/:id/read - Mark notification as read
 * POST /api/notifications/read-all - Mark all notifications as read
 *
 * Event types: agent_complete, validation_result, workflow_transition, confidence_update
 */

import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { getRequestSupabaseClient } from "../../lib/supabase.js";
import { requireRole } from "../../middleware/auth.js";
import { auditLogService } from "../../services/security/AuditLogService.js";

import { ValueCasesRouteLimiters } from "./valueCases/crud.routes.js";

const router = Router();

// ============================================================================
// Types & Schemas
// ============================================================================

export type NotificationType =
  | "agent_complete"
  | "validation_result"
  | "workflow_transition"
  | "confidence_update"
  | "hypothesis_promoted"
  | "scenario_recalculated"
  | "board_ready_available"
  | "approval_required";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  caseId?: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  actionLabel?: string;
}

const MarkReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
});

interface NotificationRequest extends Request {
  tenantId?: string;
  organizationId?: string;
  user?: { id: string; email?: string };
}

// ============================================================================
// SSE Stream Handler
// ============================================================================

interface ClientConnection {
  id: string;
  tenantId: string;
  userId: string;
  response: Response;
  lastEventId: string | null;
  heartbeatInterval: NodeJS.Timeout;
}

// In-memory client registry (use Redis in production for multi-instance)
const connectedClients = new Map<string, ClientConnection>();
const MAX_SSE_CLIENTS = 1000; // Prevent DoS via connection exhaustion

function cleanupClient(clientId: string, heartbeatInterval: NodeJS.Timeout): void {
  clearInterval(heartbeatInterval);
  connectedClients.delete(clientId);
}

/**
 * Send notification to all connected clients for a tenant/user
 */
export function broadcastNotification(
  tenantId: string,
  userId: string | null,
  notification: Notification
): void {
  for (const client of connectedClients.values()) {
    if (client.tenantId === tenantId && (!userId || client.userId === userId)) {
      sendSseEvent(client.response, "notification", notification);
    }
  }
}

function sendSseEvent(
  response: Response,
  event: string,
  data: unknown,
  id?: string
): void {
  if (id) {
    response.write(`id: ${id}\n`);
  }
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendHeartbeat(response: Response): void {
  response.write(":heartbeat\n\n");
}

async function notificationStream(
  req: NotificationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.organizationId;
  const userId = req.user?.id;

  if (!tenantId || !userId) {
    res.status(401).json({ error: "Missing tenant or user context" });
    return;
  }

  // Enforce maximum client limit to prevent DoS
  if (connectedClients.size >= MAX_SSE_CLIENTS) {
    res.status(503).json({ error: "Server at capacity, please try again later" });
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send initial connection event
  sendSseEvent(res, "connected", {
    clientId: `${tenantId}:${userId}:${Date.now()}`,
    timestamp: new Date().toISOString(),
  });

  let heartbeatInterval: NodeJS.Timeout | null = null;

  // Send any unread notifications as initial batch
  try {
    const db = getRequestSupabaseClient(req);
    const { data: unreadNotifications, error } = await db
      .from("notifications")
      .select("*")
      .eq("organization_id", tenantId)
      .eq("user_id", userId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && unreadNotifications) {
      sendSseEvent(res, "initial_batch", { notifications: unreadNotifications });
    }
  } catch (fetchError) {
    logger.warn("Failed to fetch initial notifications", { fetchError });
  }

  // Set up heartbeat
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(res);
  }, 30000); // 30 seconds

  // Register client
  const clientId = `${tenantId}:${userId}:${Date.now()}`;
  const client: ClientConnection = {
    id: clientId,
    tenantId,
    userId,
    response: res,
    lastEventId: req.headers["last-event-id"] as string | null,
    heartbeatInterval,
  };
  connectedClients.set(clientId, client);

  logger.info("SSE client connected", { clientId, tenantId, userId, totalClients: connectedClients.size });

  // Handle disconnect on response close (not request)
  res.on("close", () => {
    cleanupClient(clientId, heartbeatInterval!);
    logger.info("SSE client disconnected", { clientId });
  });

  // Handle request errors
  req.on("error", (error) => {
    cleanupClient(clientId, heartbeatInterval!);
    logger.warn("SSE client error", { clientId, error: error.message });
  });

  // Keep connection alive
  res.flush?.();
}

// ============================================================================
// Notification History
// ============================================================================

async function getNotifications(
  req: NotificationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.organizationId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      res.status(401).json({ error: "Missing tenant or user context" });
      return;
    }

    const { limit = "20", offset = "0", unreadOnly = "false" } = req.query;

    const db = getRequestSupabaseClient(req);
    let query = db
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("organization_id", tenantId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    if (unreadOnly === "true") {
      query = query.eq("read", false);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch notifications", { error: error.message });
      res.status(500).json({ error: "Failed to fetch notifications" });
      return;
    }

    res.json({
      success: true,
      data: {
        notifications: notifications ?? [],
        total: count ?? 0,
        unread: notifications?.filter((n) => !n.read).length ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Mark as Read
// ============================================================================

async function markAsRead(
  req: NotificationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const tenantId = req.organizationId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      res.status(401).json({ error: "Missing tenant or user context" });
      return;
    }

    const db = getRequestSupabaseClient(req);
    const { data: notification, error } = await db
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", tenantId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to mark notification as read", { error: error.message, id });
      res.status(500).json({ error: "Failed to mark notification as read" });
      return;
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
}

async function markAllAsRead(
  req: NotificationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.organizationId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      res.status(401).json({ error: "Missing tenant or user context" });
      return;
    }

    const body = MarkReadSchema.safeParse(req.body);
    const notificationIds = body.success ? body.data.notificationIds : undefined;

    const db = getRequestSupabaseClient(req);
    let query = db
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("organization_id", tenantId)
      .eq("user_id", userId)
      .eq("read", false);

    if (notificationIds && notificationIds.length > 0) {
      query = query.in("id", notificationIds);
    }

    const { data: notifications, error } = await query.select();

    if (error) {
      logger.error("Failed to mark notifications as read", { error: error.message });
      res.status(500).json({ error: "Failed to mark notifications as read" });
      return;
    }

    res.json({
      success: true,
      data: {
        markedRead: notifications?.length ?? 0,
        notifications: notifications ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerNotificationRoutes(
  router: Router,
  { standardLimiter, strictLimiter }: ValueCasesRouteLimiters
): void {
  // SSE stream - long-lived connections need relaxed rate limiting
  router.get(
    "/notifications/stream",
    standardLimiter,
    requireRole(["admin", "member"]),
    notificationStream
  );

  // REST endpoints
  router.get(
    "/notifications",
    standardLimiter,
    requireRole(["admin", "member"]),
    getNotifications
  );

  router.post(
    "/notifications/:id/read",
    standardLimiter,
    requireRole(["admin", "member"]),
    markAsRead
  );

  router.post(
    "/notifications/read-all",
    strictLimiter,
    requireRole(["admin", "member"]),
    markAllAsRead
  );
}

export default router;
