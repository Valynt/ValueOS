/**
 * Back-half value loop endpoints.
 *
 * GET  /api/v1/cases/:id/integrity        — latest integrity result
 * POST /api/v1/cases/:id/integrity/run    — trigger IntegrityAgent
 * GET  /api/v1/cases/:id/narrative        — latest narrative draft
 * POST /api/v1/cases/:id/narrative/run    — trigger NarrativeAgent
 * GET  /api/v1/cases/:id/realization      — latest realization report
 * POST /api/v1/cases/:id/realization/run  — trigger RealizationAgent
 *
 * All endpoints require authentication and tenant context. Agent runs are
 * executed synchronously (direct mode) and return the agent output inline.
 */

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { CircuitBreaker } from '../../lib/agent-fabric/CircuitBreaker.js';
import { createAgentFactory } from '../../lib/agent-fabric/AgentFactory.js';
import { LLMGateway } from '../../lib/agent-fabric/LLMGateway.js';
import { MemorySystem } from '../../lib/agent-fabric/MemorySystem.js';
import { SupabaseMemoryBackend } from '../../lib/agent-fabric/SupabaseMemoryBackend.js';
import { semanticMemory } from '../../services/SemanticMemory.js';
import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest, requireAuth } from '../../middleware/auth.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { IntegrityResultRepository } from '../../repositories/IntegrityResultRepository.js';
import { NarrativeDraftRepository } from '../../repositories/NarrativeDraftRepository.js';
import { RealizationReportRepository } from '../../repositories/RealizationReportRepository.js';
import { ExpansionOpportunityRepository } from '../../repositories/ExpansionOpportunityRepository.js';
import { getPdfExportService } from '../../services/PdfExportService.js';
import type { LifecycleContext, LifecycleStage } from '../../types/agent.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getTenantId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return (
    authReq.tenantId ??
    authReq.organizationId ??
    (authReq.user?.tenant_id as string | undefined) ??
    ''
  );
}

function getCaseId(req: Request): string {
  return (req.params as Record<string, string>)['id'] ?? '';
}

const RunAgentBodySchema = z.object({
  context: z.record(z.unknown()).optional(),
  parameters: z.record(z.unknown()).optional(),
}).strict();

let _factory: ReturnType<typeof createAgentFactory> | null = null;
function getFactory() {
  if (!_factory) {
    _factory = createAgentFactory({
      llmGateway: new LLMGateway({ provider: 'openai', model: 'gpt-4o-mini' }),
      memorySystem: new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend(semanticMemory),
      ),
      circuitBreaker: new CircuitBreaker(),
    });
  }
  return _factory;
}

async function runAgent(
  req: Request,
  res: Response,
  agentId: string,
  lifecycleStage: LifecycleStage,
): Promise<Response> {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  const userId = (req as AuthenticatedRequest).user?.id ?? 'unknown';

  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Tenant context required' });
  }
  if (!caseId) {
    return res.status(400).json({ success: false, error: 'Case ID required' });
  }

  const parsed = RunAgentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const factory = getFactory();
  if (!factory.hasFabricAgent(agentId)) {
    return res.status(404).json({ success: false, error: `Agent "${agentId}" not registered` });
  }

  const jobId = uuidv4();
  const startTime = Date.now();

  try {
    const agent = factory.create(agentId, tenantId);
    const context: LifecycleContext = {
      workspace_id: jobId,
      organization_id: tenantId,
      user_id: userId,
      lifecycle_stage: lifecycleStage,
      user_inputs: {
        value_case_id: caseId,
        ...(parsed.data.parameters ?? {}),
      },
      workspace_data: {},
      previous_stage_outputs: (parsed.data.context as Record<string, unknown> | undefined)?.previous_stage_outputs as Record<string, unknown> | undefined,
      metadata: { job_id: jobId, value_case_id: caseId },
    };

    const output = await agent.execute(context);
    const durationMs = Date.now() - startTime;

    logger.info('Back-half agent run completed', {
      agentId, caseId, tenantId, userId,
      status: output.status, duration_ms: durationMs,
    });

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        agentId,
        status: output.status,
        result: output.result,
        confidence: output.confidence,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    logger.error('Back-half agent run failed', {
      agentId, caseId, tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ success: false, error: 'Agent execution failed' });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const backHalfRouter = Router({ mergeParams: true });

const auth = [requireAuth, tenantContextMiddleware()];

// ── Integrity ────────────────────────────────────────────────────────────────

const integrityRepo = new IntegrityResultRepository();

backHalfRouter.get('/:id/integrity', ...auth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant context required' });

  try {
    const result = await integrityRepo.getLatestForCase(caseId, tenantId);
    if (!result) return res.status(404).json({ success: false, error: 'No integrity result found for this case' });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error('GET integrity result failed', { caseId, tenantId, error: (err as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to fetch integrity result' });
  }
});

backHalfRouter.post('/:id/integrity/run', ...auth, async (req: Request, res: Response) => {
  return runAgent(req, res, 'integrity', 'integrity');
});

// ── Narrative ────────────────────────────────────────────────────────────────

const narrativeRepo = new NarrativeDraftRepository();

backHalfRouter.get('/:id/narrative', ...auth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant context required' });

  try {
    const draft = await narrativeRepo.getLatestForCase(caseId, tenantId);
    if (!draft) return res.status(404).json({ success: false, error: 'No narrative draft found for this case' });
    return res.status(200).json({ success: true, data: draft });
  } catch (err) {
    logger.error('GET narrative draft failed', { caseId, tenantId, error: (err as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to fetch narrative draft' });
  }
});

backHalfRouter.post('/:id/narrative/run', ...auth, async (req: Request, res: Response) => {
  return runAgent(req, res, 'narrative', 'narrative');
});

// ── Realization ──────────────────────────────────────────────────────────────

const realizationRepo = new RealizationReportRepository();

backHalfRouter.get('/:id/realization', ...auth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant context required' });

  try {
    const report = await realizationRepo.getLatestForCase(caseId, tenantId);
    if (!report) return res.status(404).json({ success: false, error: 'No realization report found for this case' });
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    logger.error('GET realization report failed', { caseId, tenantId, error: (err as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to fetch realization report' });
  }
});

backHalfRouter.post('/:id/realization/run', ...auth, async (req: Request, res: Response) => {
  return runAgent(req, res, 'realization', 'realization');
});

// ── Expansion ────────────────────────────────────────────────────────────────

const expansionRepo = new ExpansionOpportunityRepository();

backHalfRouter.get('/:id/expansion', ...auth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant context required' });

  try {
    const opportunities = await expansionRepo.getLatestRunForCase(caseId, tenantId);
    if (opportunities.length === 0) {
      return res.status(404).json({ success: false, error: 'No expansion opportunities found for this case' });
    }
    return res.status(200).json({ success: true, data: opportunities });
  } catch (err) {
    logger.error('GET expansion opportunities failed', { caseId, tenantId, error: (err as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to fetch expansion opportunities' });
  }
});

backHalfRouter.post('/:id/expansion/run', ...auth, async (req: Request, res: Response) => {
  return runAgent(req, res, 'expansion', 'expansion');
});

// ── PDF Export ────────────────────────────────────────────────────────────────

/**
 * Allowed origins for PDF renderUrl (SSRF protection).
 *
 * Only the app's own origin is permitted. Requests to internal network
 * addresses, cloud metadata endpoints, or arbitrary external URLs are blocked.
 * Set PDF_ALLOWED_ORIGINS (comma-separated) to override in non-standard
 * deployments. Falls back to APP_URL, then localhost.
 */
function getAllowedRenderOrigins(): string[] {
  const envOrigins = process.env.PDF_ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  const appUrl = process.env.APP_URL ?? 'http://localhost:3001';
  try {
    return [new URL(appUrl).origin];
  } catch {
    // APP_URL is misconfigured — log and return empty list so all renderUrls
    // are rejected rather than crashing the request handler.
    logger.error('PDF export: APP_URL is not a valid URL, all renderUrl requests will be blocked', {
      appUrl,
    });
    return [];
  }
}

function isAllowedRenderUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  // Block non-http(s) schemes (file://, gopher://, etc.)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const origin = parsed.origin;
  return getAllowedRenderOrigins().some((allowed) => origin === allowed);
}

const PdfExportBodySchema = z.object({
  renderUrl: z.string().url(),
  title: z.string().optional(),
}).strict();

backHalfRouter.post('/:id/export/pdf', ...auth, async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant context required' });

  const parsed = PdfExportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.message });
  }

  const { renderUrl, title } = parsed.data;

  // SSRF protection: renderUrl must resolve to the app's own origin.
  if (!isAllowedRenderUrl(renderUrl)) {
    logger.warn('PDF export blocked: renderUrl not in allowed origins', {
      caseId,
      tenantId,
      renderUrl,
    });
    return res.status(400).json({
      success: false,
      error: 'renderUrl must point to the application origin',
    });
  }

  // Extract auth token from the incoming request to pass to Puppeteer
  const authToken =
    (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '') ?? undefined;

  try {
    const result = await getPdfExportService().exportValueCase({
      organizationId: tenantId,
      caseId,
      renderUrl,
      authToken,
      title: title ?? `Value Case ${caseId}`,
    });

    logger.info('PDF export completed', { caseId, tenantId, sizeBytes: result.sizeBytes });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = (err as Error).message;
    logger.error('PDF export failed', { caseId, tenantId, error: message });

    // Puppeteer not installed — return 501 so the frontend can fall back to HTML
    if (message.includes('Puppeteer is not installed')) {
      return res.status(501).json({
        success: false,
        error: 'PDF generation not available in this environment',
        fallback: 'html',
      });
    }

    return res.status(500).json({ success: false, error: 'PDF export failed' });
  }
});
