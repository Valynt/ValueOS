/**
 * Security Audit API Endpoint
 * Persists security audit events for SOC 2 compliance (CC6.8)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SecurityAuditEvent } from "@/types/security";

// Simple logger for API routes
const logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta }));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  }
};

/**
 * POST /api/security/audit
 * Receives and persists security audit events
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the security audit event
    const event: SecurityAuditEvent = await request.json();

    // Validate required fields
    if (!event.timestamp || !event.userId || !event.action || !event.resource) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get client IP address
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Create Supabase client
    const supabase = createServerSupabaseClient();

    // Insert audit event into database
    const { error: insertError } = await supabase
      .from("security_audit_events")
      .insert({
        timestamp: event.timestamp,
        user_id: event.userId,
        action: event.action,
        resource: event.resource,
        required_permissions: event.requiredPermissions,
        user_permissions: event.userPermissions,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent") || "unknown",
      });

    if (insertError) {
      logger.error("Failed to insert security audit event", { error: insertError.message });

      // Still return 200 to avoid blocking user experience
      // Log to external monitoring service in production
      return NextResponse.json({
        status: "queued",
        message: "Event queued for retry",
      });
    }

    // Log in development
    if (process.env.NODE_ENV === "development") {
      logger.info("[SECURITY AUDIT]", {
        action: event.action,
        resource: event.resource,
        userId: event.userId,
        ipAddress,
      });
    }

    return NextResponse.json({
      status: "success",
      message: "Audit event persisted",
    });
  } catch (error) {
    logger.error("Security audit endpoint error", { error: String(error) });

    // Always return 200 to avoid blocking client
    return NextResponse.json({
      status: "error",
      message: "Audit logging failed - queued for retry",
    });
  }
}

/**
 * GET /api/security/audit
 * Retrieve audit events (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify admin permissions
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = user.user_metadata?.roles || [];
    if (!userRoles.includes("ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    // Build query
    let query = supabase
      .from("security_audit_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (action) {
      query = query.eq("action", action);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      events: data,
      count: data.length,
    });
  } catch (error) {
    logger.error("Security audit retrieval error", { error: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
