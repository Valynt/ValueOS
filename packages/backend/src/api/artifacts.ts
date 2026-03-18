/**
 * Artifact API Routes
 *
 * REST endpoints for artifact CRUD operations and generation.
 * Tasks: 8.1, 8.2, 8.3, 8.4
 */

import { Router, type IRouter } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { ArtifactEditService } from "../services/artifacts/ArtifactEditService";
import { ArtifactRepository } from "../services/artifacts/ArtifactRepository";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const GenerateArtifactsSchema = z.object({
  readinessScore: z.number().min(0).max(1).optional(),
  blockers: z.array(z.string()).optional(),
});

const EditArtifactSchema = z.object({
  fieldPath: z.string(),
  oldValue: z.string().optional(),
  newValue: z.string(),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Repositories and Services
// ---------------------------------------------------------------------------

const artifactRepo = new ArtifactRepository();
const editService = new ArtifactEditService();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/cases/:caseId/artifacts/generate
 * Trigger full artifact suite generation.
 */
router.post(
  "/cases/:caseId/artifacts/generate",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;
      const userId = req.userId as string;

      const body = GenerateArtifactsSchema.parse(req.body);

      // TODO: Trigger NarrativeAgent to generate full artifact suite
      // For now, return a placeholder indicating this needs to be wired
      // to the enhanced NarrativeAgent

      res.status(202).json({
        message: "Artifact generation queued",
        caseId,
        tenantId,
        readinessScore: body.readinessScore ?? 0,
        blockers: body.blockers ?? [],
        // In the full implementation, this would queue a job for the NarrativeAgent
        // to generate all 4 artifact types
        jobId: `generate-artifacts-${Date.now()}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/cases/:caseId/artifacts
 * List all artifacts for a case.
 */
router.get(
  "/cases/:caseId/artifacts",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;

      const artifacts = await artifactRepo.getByCaseId(caseId, tenantId, organizationId);

      res.json({
        caseId,
        artifacts: artifacts.map((a) => ({
          id: a.id,
          artifactType: a.artifact_type,
          status: a.status,
          readinessScoreAtGeneration: a.readiness_score_at_generation,
          generatedByAgent: a.generated_by_agent,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/cases/:caseId/artifacts/:artifactId
 * Retrieve a single artifact with full content.
 */
router.get(
  "/cases/:caseId/artifacts/:artifactId",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId, artifactId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;

      const artifact = await artifactRepo.getById(artifactId, tenantId, organizationId);

      if (!artifact || artifact.case_id !== caseId) {
        res.status(404).json({ error: "Artifact not found" });
        return;
      }

      res.json({
        id: artifact.id,
        artifactType: artifact.artifact_type,
        status: artifact.status,
        content: artifact.content_json,
        readinessScoreAtGeneration: artifact.readiness_score_at_generation,
        generatedByAgent: artifact.generated_by_agent,
        provenanceRefs: artifact.provenance_refs,
        createdAt: artifact.created_at,
        updatedAt: artifact.updated_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/cases/:caseId/artifacts/:artifactId
 * Inline edit of an artifact (creates audit trail).
 */
router.patch(
  "/cases/:caseId/artifacts/:artifactId",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId, artifactId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;
      const userId = req.userId as string;

      const body = EditArtifactSchema.parse(req.body);

      // Verify artifact exists and belongs to this case
      const artifact = await artifactRepo.getById(artifactId, tenantId, organizationId);
      if (!artifact || artifact.case_id !== caseId) {
        res.status(404).json({ error: "Artifact not found" });
        return;
      }

      // Apply the edit
      const result = await editService.editArtifact({
        tenantId,
        organizationId,
        artifactId,
        caseId,
        fieldPath: body.fieldPath,
        oldValue: body.oldValue,
        newValue: body.newValue,
        editedByUserId: userId,
        reason: body.reason,
      });

      res.json({
        message: "Artifact updated",
        editId: result.editId,
        artifactId: result.artifactId,
        applied: result.applied,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/cases/:caseId/artifacts/:artifactId/edits
 * Get edit history for an artifact.
 */
router.get(
  "/cases/:caseId/artifacts/:artifactId/edits",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId, artifactId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;

      // Verify artifact exists and belongs to this case
      const artifact = await artifactRepo.getById(artifactId, tenantId, organizationId);
      if (!artifact || artifact.case_id !== caseId) {
        res.status(404).json({ error: "Artifact not found" });
        return;
      }

      const edits = await editService.getEditHistory(tenantId, organizationId, artifactId);

      res.json({
        artifactId,
        edits: edits.map((e) => ({
          id: e.id,
          fieldPath: e.fieldPath,
          oldValue: e.oldValue,
          newValue: e.newValue,
          editedByUserId: e.editedByUserId,
          reason: e.reason,
          createdAt: e.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
