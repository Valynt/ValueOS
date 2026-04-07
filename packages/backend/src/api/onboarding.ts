/**
 * Onboarding Research API
 *
 * REST endpoints for creating research jobs, polling status,
 * listing suggestions, and accepting/rejecting suggestions.
 */

import { createLogger } from '../lib/logger.js';
import { createRequestRlsSupabaseClient } from '../lib/supabase.js';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rateLimiter.js';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware.js';
import { buildValueFabricAlignment } from '../services/onboarding/ValueFabricAlignmentService.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { getResearchQueue } from '../workers/researchWorker.js';

const logger = createLogger({ component: 'OnboardingAPI' });
const router = Router();

router.use(securityHeadersMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateResearchJobSchema = z.object({
  contextId: z.string().uuid(),
  website: z.string().url().refine((url) => /^https?:\/\//i.test(url), {
    message: "URL must start with http:// or https://",
  }),
  industry: z.string().min(1).optional(),
  companySize: z.string().min(1).optional(),
  salesMotion: z.string().min(1).optional(),
});

const UpdateSuggestionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'edited']),
  payload: z.record(z.unknown()).optional(),
});

const BulkAcceptSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const ContextIdParamSchema = z.object({
  contextId: z.string().uuid(),
});

const TargetAlignmentQuerySchema = z.object({
  caseId: z.string().uuid().optional(),
});

type ValueFabricRecord = {
  source: 'snapshot' | 'summary';
  version: number | null;
  generated_at: string | null;
  onboarding_status?: string | null;
  value_fabric: Record<string, unknown> | null;
};

async function loadValueFabricByContext(params: {
  req: Request;
  tenantId: string;
  contextId: string;
}): Promise<{ record: ValueFabricRecord | null; errorCode?: 404 }> {
  const { req, tenantId, contextId } = params;
  const supabase = createRequestRlsSupabaseClient(req);

  const { data: latestSnapshot, error: snapshotErr } = await supabase
    .from('company_context_versions')
    .select('snapshot, version, created_at')
    .eq('context_id', contextId)
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotErr) {
    logger.warn('Failed to read company_context_versions snapshot', new Error(snapshotErr.message));
  }

  if (latestSnapshot?.snapshot) {
    return {
      record: {
        source: 'snapshot',
        version: latestSnapshot.version ?? null,
        generated_at: latestSnapshot.created_at ?? null,
        value_fabric: latestSnapshot.snapshot as Record<string, unknown>,
      },
    };
  }

  const { data: contextRow, error: contextErr } = await supabase
    .from('company_contexts')
    .select('id, version, onboarding_status, metadata, updated_at')
    .eq('id', contextId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (contextErr || !contextRow) {
    return { record: null, errorCode: 404 };
  }

  const metadata = (contextRow.metadata ?? {}) as Record<string, unknown>;
  const summary = (metadata.value_fabric_summary ?? null) as Record<string, unknown> | null;

  return {
    record: {
      source: 'summary',
      version: contextRow.version ?? null,
      generated_at: contextRow.updated_at ?? null,
      onboarding_status: contextRow.onboarding_status ?? null,
      value_fabric: summary,
    },
  };
}

// ============================================================================
// Target table mapping for suggestion acceptance
// ============================================================================

const ENTITY_TABLE_MAP: Record<string, string> = {
  product: 'company_products',
  competitor: 'company_competitors',
  persona: 'company_personas',
  claim: 'company_claim_governance',
  capability: 'company_capabilities',
  value_pattern: 'company_value_patterns',
};

// ============================================================================
// POST /api/onboarding/research — Create a research job
// ============================================================================

router.post(
  '/research',
  rateLimiters.standard,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const parsed = CreateResearchJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
      }

      const { contextId, website, industry, companySize, salesMotion } = parsed.data;

      const supabase = createRequestRlsSupabaseClient(req);

      // Verify context belongs to tenant
      const { data: context, error: ctxErr } = await supabase
        .from('company_contexts')
        .select('id')
        .eq('id', contextId)
        .eq('tenant_id', tenantId)
        .single();

      if (ctxErr || !context) {
        return res.status(404).json({ error: 'Context not found' });
      }

      // Create the job record
      const { data: job, error: jobErr } = await supabase
        .from('company_research_jobs')
        .insert({
          tenant_id: tenantId,
          context_id: contextId,
          input_website: website,
          input_industry: industry ?? null,
          input_company_size: companySize ?? null,
          input_sales_motion: salesMotion ?? null,
          status: 'queued',
          entity_status: {
            product: 'pending',
            competitor: 'pending',
            persona: 'pending',
            claim: 'pending',
            capability: 'pending',
            value_pattern: 'pending',
          },
        })
        .select()
        .single();

      if (jobErr) {
        logger.error('Failed to create research job: ' + jobErr.message);
        return res.status(500).json({ error: 'Failed to create research job' });
      }

      // Enqueue to BullMQ so the research worker picks it up
      try {
        await getResearchQueue().add('research', {
          jobId: job.id,
          tenantId,
          contextId,
          website,
          industry,
          companySize,
          salesMotion,
        });
      } catch (enqueueErr) {
        logger.error('Failed to enqueue research job', enqueueErr instanceof Error ? enqueueErr : new Error(String(enqueueErr)));
        // Job row exists with status 'queued' — worker can retry via polling fallback
      }

      return res.status(201).json({ data: job });
    } catch (err) {
      logger.error('Create research job error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// GET /api/onboarding/research/:jobId — Poll job status
// ============================================================================

router.get(
  '/research/:jobId',
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      const { data: job, error } = await supabase
        .from('company_research_jobs')
        .select('*')
        .eq('id', req.params.jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.json({ data: job });
    } catch (err) {
      logger.error('Get research job error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// GET /api/onboarding/research/:jobId/suggestions — List suggestions
// ============================================================================

router.get(
  '/contexts/:contextId/value-fabric',
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const parsed = ContextIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid contextId', details: parsed.error.errors });
      }

      const { contextId } = parsed.data;
      const valueFabricResult = await loadValueFabricByContext({ req, tenantId, contextId });
      if (!valueFabricResult.record || valueFabricResult.errorCode === 404) {
        return res.status(404).json({ error: 'Context not found' });
      }

      const record = valueFabricResult.record;

      return res.json({
        data: {
          context_id: contextId,
          source: record.source,
          version: record.version ?? null,
          generated_at: record.generated_at ?? null,
          onboarding_status: record.onboarding_status ?? null,
          value_fabric: record.value_fabric ?? null,
        },
      });
    } catch (err) {
      logger.error('Get value fabric error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.get(
  '/contexts/:contextId/target-alignment',
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const paramsParsed = ContextIdParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: 'Invalid contextId', details: paramsParsed.error.errors });
      }
      const queryParsed = TargetAlignmentQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: queryParsed.error.errors });
      }

      const { contextId } = paramsParsed.data;
      const { caseId } = queryParsed.data;

      const valueFabricResult = await loadValueFabricByContext({ req, tenantId, contextId });
      if (!valueFabricResult.record || valueFabricResult.errorCode === 404) {
        return res.status(404).json({ error: 'Context not found' });
      }

      const licensorValueFabric = valueFabricResult.record.value_fabric;
      const organizationId = req.organizationId ?? tenantId;
      const supabase = createRequestRlsSupabaseClient(req);

      let targetContext: Record<string, unknown> | null = null;
      if (caseId) {
        const { data: dealContext, error: dealContextErr } = await supabase
          .from('deal_contexts')
          .select('id, case_id, opportunity_id, assembled_at, status, context_json, updated_at')
          .eq('case_id', caseId)
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dealContextErr) {
          logger.warn('Failed to read target deal context', new Error(dealContextErr.message));
        }

        if (!dealContext) {
          return res.status(404).json({ error: 'Target context not found for case' });
        }

        targetContext = dealContext as unknown as Record<string, unknown>;
      }

      const alignment = buildValueFabricAlignment({
        licensorModel: licensorValueFabric,
        targetContext,
      });

      return res.json({
        data: {
          context_id: contextId,
          licensor_scope: 'persistent',
          target_scope: 'project_scoped',
          licensor_model: {
            source: valueFabricResult.record.source,
            version: valueFabricResult.record.version,
            generated_at: valueFabricResult.record.generated_at,
            value_fabric: licensorValueFabric,
          },
          target_context: targetContext,
          case_id: caseId ?? null,
          alignment,
        },
      });
    } catch (err) {
      logger.error('Get target alignment error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.get(
  '/research/:jobId/suggestions',
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      let query = supabase
        .from('company_research_suggestions')
        .select('*')
        .eq('job_id', req.params.jobId)
        .eq('tenant_id', tenantId)
        .order('entity_type')
        .order('confidence_score', { ascending: false });

      // Optional filters
      const entityType = req.query.entity_type as string | undefined;
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const status = req.query.status as string | undefined;
      if (status) {
        query = query.eq('status', status);
      }

      const { data: suggestions, error } = await query;

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch suggestions' });
      }

      return res.json({ data: suggestions ?? [] });
    } catch (err) {
      logger.error('Get suggestions error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// PATCH /api/onboarding/suggestions/:id — Accept/Reject/Edit a suggestion
// ============================================================================

router.patch(
  '/suggestions/:id',
  rateLimiters.standard,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const parsed = UpdateSuggestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      // Fetch the suggestion
      const { data: suggestion, error: fetchErr } = await supabase
        .from('company_research_suggestions')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }

      const { status, payload: editedPayload } = parsed.data;
      const finalPayload = status === 'edited' && editedPayload
        ? editedPayload
        : suggestion.payload;

      // On accept/edit: write to the target canonical table
      if (status === 'accepted' || status === 'edited') {
        const targetTable = ENTITY_TABLE_MAP[suggestion.entity_type];
        if (targetTable) {
          const insertData = {
            ...finalPayload,
            tenant_id: tenantId,
            context_id: suggestion.context_id,
          };

          const { error: insertErr } = await supabase
            .from(targetTable)
            .insert(insertData);

          if (insertErr) {
            logger.error(`Failed to write suggestion to ${targetTable}: ${insertErr.message}`);
            return res.status(500).json({ error: `Failed to write to ${targetTable}` });
          }
        }
      }

      // Update suggestion status
      const { data: updated, error: updateErr } = await supabase
        .from('company_research_suggestions')
        .update({
          status,
          payload: finalPayload,
          accepted_at: (status === 'accepted' || status === 'edited') ? new Date().toISOString() : null,
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ error: 'Failed to update suggestion' });
      }

      return res.json({ data: updated });
    } catch (err) {
      logger.error('Update suggestion error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// POST /api/onboarding/suggestions/bulk-accept — Bulk accept suggestions
// ============================================================================

router.post(
  '/suggestions/bulk-accept',
  rateLimiters.standard,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      const parsed = BulkAcceptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      const { ids } = parsed.data;
      const results: Array<{ id: string; success: boolean; error?: string }> = [];
      const acceptedIds: string[] = [];

      const { data: allSuggestions, error: prefetchErr } = await supabase
        .from('company_research_suggestions')
        .select('*')
        .in('id', ids)
        .eq('tenant_id', tenantId);

      if (prefetchErr) {
        logger.error('Failed to prefetch suggestions', new Error(prefetchErr.message));
        return res.status(500).json({ error: 'Failed to fetch suggestions for bulk accept' });
      }

      const insertTasks: Array<{ id: string; targetTable: string; data: any }> = [];

      for (const id of ids) {
        try {
          // Find suggestion in prefetched data
          const suggestion = allSuggestions?.find((s) => s.id === id);

          if (!suggestion) {
            results.push({ id, success: false, error: 'Not found' });
            continue;
          }

          if (suggestion.status !== 'suggested') {
            results.push({ id, success: false, error: `Already ${suggestion.status}` });
            continue;
          }

          // Write to canonical table
          const targetTable = ENTITY_TABLE_MAP[suggestion.entity_type];
          if (targetTable) {
            insertTasks.push({
              id,
              targetTable,
              data: {
                ...suggestion.payload,
                tenant_id: tenantId,
                context_id: suggestion.context_id,
              }
            });
          } else {
            acceptedIds.push(id);
            results.push({ id, success: true });
          }
        } catch (err) {
          results.push({ id, success: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Execute insert operations concurrently
      const insertResults = await Promise.all(
        insertTasks.map(async (task) => {
          try {
            const { error: insertErr } = await supabase
              .from(task.targetTable)
              .insert(task.data);

            return { id: task.id, error: insertErr };
          } catch (err) {
             return { id: task.id, error: new Error(err instanceof Error ? err.message : String(err)) };
          }
        })
      );

      // Process results
      for (const result of insertResults) {
        if (result.error) {
          results.push({ id: result.id, success: false, error: result.error.message });
        } else {
          acceptedIds.push(result.id);
          results.push({ id: result.id, success: true });
        }
      }

      // Mark as accepted in bulk
      if (acceptedIds.length > 0) {
        await supabase
          .from('company_research_suggestions')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .in('id', acceptedIds);
      }

      const accepted = results.filter((r) => r.success).length;
      return res.json({ data: { results, accepted, total: ids.length } });
    } catch (err) {
      logger.error('Bulk accept error', err instanceof Error ? err : new Error(String(err)));
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
