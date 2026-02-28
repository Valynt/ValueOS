import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

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
