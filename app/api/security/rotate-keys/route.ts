/**
 * API Key Rotation Endpoint
 * Manual and automated API key rotation
 */

import { NextRequest, NextResponse } from "next/server";
import { apiKeyRotationService } from "@/services/security/APIKeyRotationService";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/security/rotate-keys
 * Manually trigger API key rotation
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { provider } = await request.json();

    if (!["openai", "anthropic", "supabase", "aws-iam"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    let result;

    switch (provider) {
      case "openai":
        result = await apiKeyRotationService.rotateOpenAIKey();
        break;
      case "anthropic":
        result = await apiKeyRotationService.rotateAnthropicKey();
        break;
      case "supabase":
        result = await apiKeyRotationService.rotateSupabaseKey();
        break;
      case "aws-iam":
        result = await apiKeyRotationService.rotateAWSKeys();
        break;
    }

    return NextResponse.json({
      success: true,
      rotation: result,
    });
  } catch (error) {
    console.error("API key rotation error:", error);
    return NextResponse.json(
      {
        error: "Rotation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/security/rotate-keys
 * Get rotation status for all API keys
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

    // Get rotation history from audit logs
    const { data: rotations } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "api_key.rotate")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      rotations: rotations || [],
      scheduledRotations: {
        openai: { intervalDays: 90, autoRotate: true },
        anthropic: { intervalDays: 90, autoRotate: true },
        "aws-iam": { intervalDays: 90, autoRotate: true },
        supabase: { intervalDays: 180, autoRotate: true },
      },
    });
  } catch (error) {
    console.error("Failed to retrieve rotation status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
