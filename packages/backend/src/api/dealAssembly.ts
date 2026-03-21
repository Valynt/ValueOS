/**
 * Deal Assembly API Routes
 *
 * REST endpoints for deal assembly pipeline:
 * - POST /api/cases/:caseId/assemble           — trigger deal assembly
 * - GET  /api/cases/:caseId/context            — retrieve assembled DealContext
 * - PATCH /api/cases/:caseId/context/gaps      — submit user-provided gap fills
 * - POST /api/cases/:caseId/run-hypothesis-loop — run the full value lifecycle
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §8
 */

import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { DealAssemblyService } from "../services/deal/DealAssemblyService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Initialize service
const dealAssemblyService = new DealAssemblyService();

// ---------------------------------------------------------------------------
// Request/Response Schemas
// ---------------------------------------------------------------------------

const AssembleRequestSchema = z.object({
  opportunity_id: z.string().uuid(),
  crm_connection_id: z.string().optional(),
  transcript_ids: z.array(z.string()).optional(),
  note_ids: z.array(z.string()).optional(),
  skip_enrichment: z.boolean().optional(),
});

const GapFillRequestSchema = z.object({
  gap_id: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/cases/:caseId/assemble
 * Trigger deal assembly for an opportunity.
 * Task: 8.1
 */
router.post(
  "/cases/:caseId/assemble",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;
      const userId = req.userId as string;

      // Validate request body
      const body = AssembleRequestSchema.parse(req.body);

      logger.info("Deal assembly requested", {
        caseId,
        tenantId,
        opportunityId: body.opportunity_id,
        userId,
      });

      // TODO: Trigger DealAssemblyAgent workflow
      // For now, return accepted status with job ID
      const jobId = `assembly-${Date.now()}-${caseId}`;

      res.status(202).json({
        message: "Deal assembly initiated",
        case_id: caseId,
        job_id: jobId,
        status: "assembling",
        estimated_completion: "2-3 minutes",
        steps: [
          "crm_ingestion",
          "transcript_parsing",
          "notes_extraction",
          "public_enrichment",
          "context_extraction",
          "deal_assembly",
        ],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/cases/:caseId/context
 * Retrieve assembled DealContext.
 * Task: 8.2
 */
router.get(
  "/cases/:caseId/context",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;

      // Fetch deal context
      const context = await dealAssemblyService.getContext(caseId, organizationId);

      if (!context) {
        res.status(404).json({
          error: "Deal context not found",
          case_id: caseId,
        });
        return;
      }

      res.json({
        case_id: caseId,
        context: {
          id: context.id,
          account_name: context.account_name,
          stakeholders: context.stakeholders,
          use_cases: context.use_cases,
          pain_signals: context.pain_signals,
          value_driver_candidates: context.value_driver_candidates,
          baseline_clues: context.baseline_clues,
          gaps: context.gaps,
          assembly_status: context.assembly_status,
          extracted_from: context.extracted_from,
          created_at: context.created_at,
          updated_at: context.updated_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/cases/:caseId/context/gaps
 * Submit user-provided gap fills.
 * Task: 8.3
 */
router.patch(
  "/cases/:caseId/context/gaps",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;
      const userId = req.userId as string;

      // Validate request body
      const body = GapFillRequestSchema.parse(req.body);

      logger.info("Gap fill requested", {
        caseId,
        gapId: body.gap_id,
        userId,
      });

      // Fill the gap
      await dealAssemblyService.fillGap(
        caseId,
        organizationId,
        body.gap_id,
        body.value,
        userId
      );

      res.json({
        message: "Gap filled successfully",
        case_id: caseId,
        gap_id: body.gap_id,
        filled_by: userId,
        filled_at: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/cases/:caseId/context/confirm
 * Confirm deal assembly and mark ready for modeling.
 */
router.post(
  "/cases/:caseId/context/confirm",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.organizationId as string;

      await dealAssemblyService.confirmAssembly(caseId, organizationId);

      res.json({
        message: "Deal assembly confirmed",
        case_id: caseId,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Hypothesis Loop
// ---------------------------------------------------------------------------

const HypothesisLoopRequestSchema = z.object({
  session_id: z.string().optional(),
});

/**
 * POST /api/cases/:caseId/run-hypothesis-loop
 *
 * Runs the full value lifecycle saga for a case:
 *   INITIATED → DRAFTING → VALIDATING → COMPOSING → REFINING → FINALIZED
 *
 * Each stage is executed by the corresponding fabric agent (OpportunityAgent,
 * TargetAgent, IntegrityAgent, NarrativeAgent, RealizationAgent). The saga
 * state and all agent outputs are persisted to the database.
 *
 * Returns the final saga state and a summary of outputs produced.
 */
router.post(
  "/cases/:caseId/run-hypothesis-loop",
  requireAuth,
  tenantContextMiddleware,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const tenantId = req.tenantId as string;
      const organizationId = req.organizationId as string;
      const userId = (req as { userId?: string }).userId ?? "unknown";

      const body = HypothesisLoopRequestSchema.safeParse(req.body);
      const sessionId = (body.success && body.data.session_id)
        ? body.data.session_id
        : uuidv4();

      if (!req.supabase) {
        throw new Error("run-hypothesis-loop requires req.supabase");
      }

      // Verify the case belongs to this tenant before running any agents.
      // Prevents IDOR via request-scoped RLS instead of service_role.
      const caseAccess = new RequestScopedValueCaseAccessService(req.supabase);
      const caseRow = await caseAccess.assertCaseReadable({
        caseId,
        tenantId,
        userId,
        requestId: req.requestId,
        route: req.path,
      });

      if (!caseRow) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      logger.info("Hypothesis loop requested", {
        caseId,
        tenantId,
        userId,
        sessionId,
      });

      // Lazy-import to avoid circular deps at module load time
      const { ValueLifecycleOrchestrator } = await import(
        "../services/post-v1/ValueLifecycleOrchestrator.js"
      );
      const { LLMGateway } = await import(
        "../lib/agent-fabric/LLMGateway.js"
      );
      const { MemorySystem } = await import(
        "../lib/agent-fabric/MemorySystem.js"
      );
      const { SupabaseMemoryBackend } = await import(
        "../lib/agent-fabric/SupabaseMemoryBackend.js"
      );
      const { AuditLogger } = await import(
        "../lib/agent-fabric/AuditLogger.js"
      );

      // Reuse the authenticated request-scoped client for orchestration.
      const supabaseClient = req.supabase;

      const llmGateway = new LLMGateway({
        provider: "together",
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      });

      const memorySystem = new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend(),
      );

      const auditLogger = new AuditLogger();

      const orchestrator = new ValueLifecycleOrchestrator(
        supabaseClient,
        llmGateway,
        memorySystem,
        auditLogger,
      );

      const result = await orchestrator.runHypothesisLoop(caseId, {
        userId,
        tenantId,
        organizationId,
        sessionId,
      });

      if (!result.success) {
        logger.warn("Hypothesis loop completed with failure", {
          caseId,
          tenantId,
          finalState: result.finalState,
          error: result.error,
        });

        res.status(422).json({
          success: false,
          case_id: caseId,
          final_state: result.finalState,
          error: result.error ?? "Hypothesis loop did not reach FINALIZED state",
        });
        return;
      }

      logger.info("Hypothesis loop completed successfully", {
        caseId,
        tenantId,
        finalState: result.finalState,
        sessionId,
      });

      // Recompute integrity score after agent run completes.
      // Non-fatal: a scoring failure must not block the response.
      try {
        const { valueIntegrityService } = await import(
          "../services/integrity/ValueIntegrityService.js"
        );
        const accessToken =
          (req.headers.authorization?.replace("Bearer ", "") ?? "");
        await valueIntegrityService.detectContradictions(
          caseId,
          organizationId,
          accessToken,
          sessionId,
        );
        await valueIntegrityService.recomputeScore(
          caseId,
          organizationId,
          accessToken,
        );
      } catch (integrityErr) {
        logger.warn("Integrity recompute failed after hypothesis loop", {
          caseId,
          error: integrityErr instanceof Error ? integrityErr.message : String(integrityErr),
        });
      }

      res.json({
        success: true,
        case_id: caseId,
        final_state: result.finalState,
        session_id: sessionId,
        message: "Value lifecycle completed. Outputs persisted to database.",
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
