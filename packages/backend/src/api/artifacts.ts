/**
 * Artifact API Routes
 *
 * REST endpoints for artifact CRUD operations and generation.
 * Tasks: 8.1, 8.2, 8.3, 8.4
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import { type IRouter, Router } from "express";
import { z } from "zod";

import { getAgentMessageQueueConfig } from "../config/ServiceConfigManager.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { checkPermission } from "../middleware/rbac.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { ArtifactEditService } from "../services/artifacts/ArtifactEditService";
import { ArtifactJobRepository } from "../services/artifacts/ArtifactJobRepository";
import { ArtifactRepository } from "../services/artifacts/ArtifactRepository";
import { ARTIFACT_GENERATION_QUEUE_NAME, type ArtifactGenerationJobPayload } from "../workers/ArtifactGenerationWorker.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const GenerateArtifactsSchema = z.object({
  artifactType: z
    .enum(["executive_summary", "executive_memo", "cfo_recommendation", "customer_narrative", "internal_case"])
    .optional(),
  format: z.enum(["markdown", "json", "html"]).optional(),
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
// Repositories, Services, and Queue
// ---------------------------------------------------------------------------

const artifactRepo = new ArtifactRepository();
const artifactJobRepo = new ArtifactJobRepository();
const editService = new ArtifactEditService();

// Single shared queue instance — avoids opening a new Redis connection per request.
function createArtifactQueue(): Queue<ArtifactGenerationJobPayload> {
  const config = getAgentMessageQueueConfig();
  const redisUrl = config.redis.url ?? "redis://localhost:6379";
  return new Queue<ArtifactGenerationJobPayload>(ARTIFACT_GENERATION_QUEUE_NAME, {
    connection: { url: redisUrl },
  });
}
const artifactQueue = createArtifactQueue();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/cases/:caseId/artifacts/generate
 *
 * Creates a real artifact_jobs row, enqueues a BullMQ job, and returns the
 * persisted jobId. The worker invokes NarrativeAgent with live case context
 * and persists the generated artifact on completion.
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
      const artifactType = body.artifactType ?? "executive_summary";
      const format = body.format ?? "markdown";
      const supabase = req.supabase as SupabaseClient | undefined;

      if (!supabase) {
        res.status(401).json({ error: "Authenticated Supabase context required." });
        return;
      }

      // Authorization: caller must have artifact.generate permission.
      const canGenerate = await checkPermission(supabase, userId, tenantId, "artifacts:create" as never);
      if (!canGenerate) {
        res.status(403).json({ error: "Insufficient permissions to generate artifacts." });
        return;
      }

      // Verify the case exists and belongs to this tenant.
      const { data: valueCase, error: caseError } = await supabase
        .from("value_cases")
        .select("id, status")
        .eq("id", caseId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (caseError) {
        logger.error("artifacts/generate: failed to verify case", { caseId, error: caseError.message });
        return next(caseError);
      }
      if (!valueCase) {
        res.status(404).json({ error: "Value case not found." });
        return;
      }

      // Idempotency: return the existing job if one is already queued or running
      // for this (caseId, artifactType) combination. Prevents duplicate jobs on
      // client retries or double-submits.
      const existingJob = await artifactJobRepo.findActiveJob(caseId, artifactType, tenantId);
      if (existingJob) {
        logger.info("artifacts/generate: returning existing active job", {
          jobId: existingJob.id,
          caseId,
          tenantId,
          artifactType,
          status: existingJob.status,
        });
        res.status(202).json({
          jobId: existingJob.id,
          status: existingJob.status,
          caseId,
          artifactType,
          format: existingJob.format,
        });
        return;
      }

      // Create a persistent artifact_jobs row before enqueuing.
      const job = await artifactJobRepo.create({
        tenantId,
        organizationId,
        caseId,
        artifactType,
        format,
        requestedBy: userId,
      });

      // Enqueue the generation job. The worker will update job status as it runs.
      const traceId = randomUUID();
      await artifactQueue.add(
        "generate-artifact",
        {
          jobId: job.id,
          tenantId,
          organizationId,
          caseId,
          artifactType,
          format,
          requestedBy: userId,
          traceId,
        } satisfies ArtifactGenerationJobPayload,
        {
          jobId: `artifact-${job.id}`,
          attempts: 2,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      logger.info("artifacts/generate: job enqueued", {
        jobId: job.id,
        caseId,
        tenantId,
        artifactType,
        traceId,
      });

      res.status(202).json({
        jobId: job.id,
        status: "queued",
        caseId,
        artifactType,
        format,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/artifact-jobs/:jobId
 *
 * Returns the current status of an artifact generation job.
 * Enforces tenant isolation — returns 404 for cross-tenant access.
 */
router.get(
  "/artifact-jobs/:jobId",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const tenantId = req.tenantId as string;

      const job = await artifactJobRepo.findById(jobId, tenantId);
      if (!job) {
        res.status(404).json({ error: "Artifact job not found." });
        return;
      }

      res.json({
        jobId: job.id,
        status: job.status,
        caseId: job.case_id,
        artifactType: job.artifact_type,
        format: job.format,
        artifactId: job.artifact_id ?? undefined,
        errorMessage: job.error_message ?? undefined,
        createdAt: job.created_at,
        startedAt: job.started_at ?? undefined,
        completedAt: job.completed_at ?? undefined,
        failedAt: job.failed_at ?? undefined,
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
