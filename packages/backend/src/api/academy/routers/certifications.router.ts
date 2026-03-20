/**
 * Certifications Router
 * Handles certification awards, retrieval, and PDF generation with tenant isolation
 */
import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

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

function getSupabaseClient(ctx: { supabase?: RequestScopedRlsSupabaseClient; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createRequestSupabaseClient({ accessToken: ctx.accessToken });
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
 * Generate a secure share token using HMAC-SHA256.
 * Requires SHARE_TOKEN_SECRET env var (minimum 32 characters).
 */
function generateSecureShareToken(userId: string, certId: number, awardedAt: string): string {
  const secret = process.env.SHARE_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "SHARE_TOKEN_SECRET is missing or too short (minimum 32 characters)",
    });
  }
  const data = `${userId}:${certId}:${new Date(awardedAt).getTime()}`;
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

// ============================================================================
// Database Operations
// ============================================================================

async function getUserCertifications(
  client: RequestScopedRlsSupabaseClient,
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

async function getPillarById(client: RequestScopedRlsSupabaseClient, pillarId: number) {
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

async function getUserById(client: RequestScopedRlsSupabaseClient, userId: string) {
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
// PDF Generation
// ============================================================================

interface CertificateInput {
  userName: string;
  pillarTitle: string;
  vosRole: string;
  tier: "bronze" | "silver" | "gold";
  score: number;
  awardedAt: Date;
  certificateId: string;
}

const TIER_COLORS: Record<string, { r: number; g: number; b: number }> = {
  gold: { r: 212, g: 175, b: 55 },
  silver: { r: 168, g: 169, b: 173 },
  bronze: { r: 176, g: 141, b: 87 },
};

async function generateCertificatePDF(data: CertificateInput): Promise<string> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const color = TIER_COLORS[data.tier] ?? TIER_COLORS.bronze;

  // Border
  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(2);
  doc.rect(10, 10, width - 20, height - 20);

  // Title
  doc.setFontSize(28);
  doc.setTextColor(40, 40, 40);
  doc.text("Certificate of Achievement", width / 2, 45, { align: "center" });

  // ValueOS Academy
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("ValueOS Academy", width / 2, 55, { align: "center" });

  // Recipient
  doc.setFontSize(22);
  doc.setTextColor(color.r, color.g, color.b);
  doc.text(data.userName, width / 2, 85, { align: "center" });

  // Description
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Has successfully completed the ${data.pillarTitle} pillar`,
    width / 2,
    100,
    { align: "center" },
  );
  doc.text(
    `Role: ${data.vosRole}  |  Tier: ${data.tier.toUpperCase()}  |  Score: ${data.score}%`,
    width / 2,
    110,
    { align: "center" },
  );

  // Date & ID
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Awarded: ${data.awardedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    width / 2,
    130,
    { align: "center" },
  );
  doc.text(`Certificate ID: ${data.certificateId}`, width / 2, 138, {
    align: "center",
  });

  // Return base64-encoded PDF
  return doc.output("datauristring").split(",")[1];
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
        certificateId: `VOS-${cert.id}-${cert.awardedAt}`,
      };

      logger.info("[Academy] Certificate generation requested", {
        userId: ctx.user.id,
        certificationId: cert.id,
        format: input.format,
      });

      const certificateBlob = await generateCertificatePDF(certificateData);

      return {
        certificateData,
        certificateBlob,
        downloadUrl: `/api/certificates/${cert.id}/download`,
      };
    }),
});
