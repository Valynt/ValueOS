import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getAuditRequestContext, logAuditEvent } from "../../lib/auditLogger";

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
 * Certifications router
 * Handles certification awards, retrieval, and PDF generation
 */
export const certificationsRouter = router({
  /**
   * Get all certifications for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserCertifications(ctx.user.id);
  }),
  
  /**
   * Get user certifications with frontend-friendly format
   */
  getUserCertifications: protectedProcedure.query(async ({ ctx }) => {
    const certs = await db.getUserCertifications(ctx.user.id);
    
    // Transform to match frontend interface
    return certs.map(cert => ({
      id: cert.id,
      pillarNumber: cert.pillarId,
      pillarTitle: cert.badgeName.split(' - ')[0] || 'Unknown Pillar',
      tier: determineCertificationTier(cert),
      score: cert.score || 100,
      earnedAt: cert.awardedAt,
      expiresAt: null, // Certifications don't expire by default
    }));
  }),



  /**
   * Create share payload for a certification and emit audit event
   */
  createShareLink: protectedProcedure
    .input(z.object({
      certificationId: z.number(),
      channel: z.enum(['copy', 'linkedin', 'email', 'native']).default('copy'),
    }))
    .mutation(async ({ ctx, input }) => {
      const certifications = await db.getUserCertifications(ctx.user.id);
      const cert = certifications.find((item) => item.id === input.certificationId);

      if (!cert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Certification not found',
        });
      }

      const badgeName = cert.badgeName.split(' - ')[0] || 'VOS Certification';
      const baseUrl = process.env.VOS_ACADEMY_PUBLIC_URL || 'https://academy.valueos.ai';
      const shareToken = Buffer.from(`${ctx.user.id}:${cert.id}:${cert.awardedAt.getTime()}`).toString('base64url');
      const shareUrl = `${baseUrl}/certifications/verify?token=${shareToken}`;

      const requestContext = getAuditRequestContext(ctx.req);
      await logAuditEvent({
        actor: String(ctx.user.id),
        tenantId: process.env.SESSION_JWT_TENANT || process.env.VITE_APP_ID || undefined,
        action: 'certification.share_link.generated',
        result: 'success',
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: {
          certificationId: cert.id,
          channel: input.channel,
          badgeName,
        },
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
    .input(z.object({
      certificationId: z.number(),
      format: z.enum(['pdf', 'png']).default('pdf')
    }))
    .mutation(async ({ ctx, input }) => {
      // Get certification details
      const certifications = await db.getUserCertifications(ctx.user.id);
      const cert = certifications.find(c => c.id === input.certificationId);

      if (!cert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Certification not found',
        });
      }

      // Get user details
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get pillar details
      const pillar = await db.getPillarById(cert.pillarId);

      const certificateData = {
        userName: user.name || 'Valued Learner',
        pillarTitle: pillar?.title || 'VOS Pillar',
        vosRole: cert.vosRole,
        tier: cert.tier as 'bronze' | 'silver' | 'gold',
        score: cert.score || 100,
        awardedAt: cert.awardedAt,
        certificateId: `VOS-${cert.id}-${Date.now().toString(36).toUpperCase()}`
      };

      // Generate certificate
      const { generateCertificatePDF } = await import('../../lib/certificate-generator');
      const certificateBlob = await generateCertificatePDF(certificateData);

      // Convert blob to base64 for API response
      const arrayBuffer = await certificateBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return {
        certificateData,
        certificateBlob: `data:application/pdf;base64,${base64}`,
        downloadUrl: `/api/certificates/${cert.id}/download`
      };
    }),
});
