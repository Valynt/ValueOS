/**
 * Certifications Router
 * Handles certification awards, retrieval, and PDF generation with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createUserSupabaseClient } from "../../../lib/supabase.js";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, router } from "../trpc.js";

// ============================================================================
// Types
// ============================================================================

interface Certification {
  id: number;
  userId: string;
  badgeName: string;
  pillarId: number;
  vosRole: string;
  tier: string;
  score: number | null;
  awardedAt: string;
}

interface UserCertification {
  id: number;
  pillarNumber: number;
  pillarTitle: string;
  tier: "bronze" | "silver" | "gold";
  score: number;
  earnedAt: string;
  expiresAt: null;
}

// ============================================================================
// Helpers
// ============================================================================

function getSupabaseClient(ctx: { supabase?: ReturnType<typeof createUserSupabaseClient>; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createUserSupabaseClient(ctx.accessToken);
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No Supabase client available",
  });
}

/**
 * Determine certification tier based on score
 * Bronze: <80%, Silver: 80-94%, Gold: 95%+
 */
function determineCertificationTier(cert: { score?: number | null }): "bronze" | "silver" | "gold" {
  const score = cert.score || 0;

  if (score >= 95) {
    return "gold";
  } else if (score >= 80) {
    return "silver";
  } else {
    return "bronze";
  }
}

/**
 * Generate a secure share token using HMAC
 * This is a placeholder - actual implementation should use crypto.createHmac
 * with a secret key stored in environment variables
 */
function generateSecureShareToken(userId: string, certId: number, awardedAt: string): string {
  // TODO: Implement proper HMAC signing with a secret key
  // For now, return a placeholder that indicates this needs proper implementation
  const data = `${userId}:${certId}:${new Date(awardedAt).getTime()}`;
  // This is NOT secure - just a placeholder format
  // Production should use: crypto.createHmac('sha256', process.env.SHARE_TOKEN_SECRET).update(data).digest('base64url')
  return `pending_hmac_${Buffer.from(data).toString("base64url")}`;
}

// ============================================================================
// Database Operations
// ============================================================================

async function getUserCertifications(
  client: ReturnType<typeof createUserSupabaseClient>,
  userId: string
): Promise<Certification[]> {
  const { data, error } = await client
    .from("certifications")
    .select("*")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });

  if (error) {
    logger.error("Failed to get user certifications", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve certifications",
    });
  }

  return (data || []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    badgeName: c.badge_name,
    pillarId: c.pillar_id,
    vosRole: c.vos_role,
    tier: c.tier,
    score: c.score,
    awardedAt: c.awarded_at,
  }));
}

async function getPillarById(client: ReturnType<typeof createUserSupabaseClient>, pillarId: number) {
  const { data, error } = await client
    .from("pillars")
    .select("*")
    .eq("id", pillarId)
    .single();

  if (error) {
    logger.error("Failed to get pillar", error);
    return null;
  }

  return data;
}

async function getUserById(client: ReturnType<typeof createUserSupabaseClient>, userId: string) {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    logger.error("Failed to get user", error);
    return null;
  }

  return data;
}

// ============================================================================
// Router
// ============================================================================

export const certificationsRouter = router({
  /**
   * Get all certifications for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getUserCertifications(client, ctx.user.id);
  }),

  /**
   * Get user certifications with frontend-friendly format
   */
  getUserCertifications: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    const certs = await getUserCertifications(client, ctx.user.id);

    // Transform to match frontend interface
    return certs.map((cert) => ({
      id: cert.id,
      pillarNumber: cert.pillarId,
      pillarTitle: cert.badgeName.split(" - ")[0] || "Unknown Pillar",
      tier: determineCertificationTier(cert),
      score: cert.score || 100,
      earnedAt: cert.awardedAt,
      expiresAt: null, // Certifications don't expire by default
    })) as UserCertification[];
  }),

  /**
   * Create share payload for a certification
   * Uses secure token generation (HMAC-based in production)
   */
  createShareLink: protectedProcedure
    .input(
      z.object({
        certificationId: z.number(),
        channel: z.enum(["copy", "linkedin", "email", "native"]).default("copy"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const certifications = await getUserCertifications(client, ctx.user.id);
      const cert = certifications.find((item) => item.id === input.certificationId);

      if (!cert) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Certification not found",
        });
      }

      const badgeName = cert.badgeName.split(" - ")[0] || "VOS Certification";
      const baseUrl = process.env.VOS_ACADEMY_PUBLIC_URL || "https://academy.valueos.ai";

      // Generate secure share token (placeholder for HMAC implementation)
      const shareToken = generateSecureShareToken(ctx.user.id, cert.id, cert.awardedAt);
      const shareUrl = `${baseUrl}/certifications/verify?token=${shareToken}`;

      logger.info("[Academy] Certification share link generated", {
        userId: ctx.user.id,
        certificationId: cert.id,
        channel: input.channel,
      });

      return {
        shareUrl,
        title: `${badgeName} Certification`,
        text: `I earned the ${badgeName} certification in VOS Academy.`,
      };
    }),

  /**
   * Generate certificate PDF
   * TODO: Move to background job for better performance
   */
  generateCertificate: protectedProcedure
    .input(
      z.object({
        certificationId: z.number(),
        format: z.enum(["pdf", "png"]).default("pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);

      // Get certification details
      const certifications = await getUserCertifications(client, ctx.user.id);
      const cert = certifications.find((c) => c.id === input.certificationId);

      if (!cert) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Certification not found",
        });
      }

      // Get user details
      const user = await getUserById(client, ctx.user.id);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get pillar details
      const pillar = await getPillarById(client, cert.pillarId);

      const certificateData = {
        userName: user.name || "Valued Learner",
        pillarTitle: pillar?.title || "VOS Pillar",
        vosRole: cert.vosRole,
        tier: cert.tier as "bronze" | "silver" | "gold",
        score: cert.score || 100,
        awardedAt: new Date(cert.awardedAt),
        certificateId: `VOS-${cert.id}-${Date.now().toString(36).toUpperCase()}`,
      };

      // TODO: Implement PDF generation
      // For now, return placeholder data
      logger.info("[Academy] Certificate generation requested", {
        userId: ctx.user.id,
        certificationId: cert.id,
        format: input.format,
      });

      return {
        certificateData,
        certificateBlob: null, // Would be base64 encoded PDF
        downloadUrl: `/api/certificates/${cert.id}/download`,
      };
    }),
});
