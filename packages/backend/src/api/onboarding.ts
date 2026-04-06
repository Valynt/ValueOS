/**
 * Onboarding Research API
 *
 * REST endpoints for creating research jobs, polling status,
 * listing suggestions, and accepting/rejecting suggestions.
 */

import { createLogger } from '@shared/lib/logger';
import { createRequestRlsSupabaseClient } from '../lib/supabase.js';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rateLimiter.js';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware.js';
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
  website: z.string().url(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  salesMotion: z.string().optional(),
});

const UpdateSuggestionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'edited']),
  payload: z.record(z.unknown()).optional(),
});

const BulkAcceptSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

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

      // Pre-fetch all suggestions to avoid N+1 queries
      const { data: fetchedSuggestions, error: bulkFetchErr } = await supabase
        .from('company_research_suggestions')
        .select('*')
        .in('id', ids)
        .eq('tenant_id', tenantId);

      const suggestionsMap = new Map();
      if (!bulkFetchErr && fetchedSuggestions) {
        for (const suggestion of fetchedSuggestions) {
          suggestionsMap.set(suggestion.id, suggestion);
        }
      }

      for (const id of ids) {
        try {
          const suggestion = suggestionsMap.get(id);

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
            const { error: insertErr } = await supabase
              .from(targetTable)
              .insert({
                ...suggestion.payload,
                tenant_id: tenantId,
                context_id: suggestion.context_id,
              });

            if (insertErr) {
              results.push({ id, success: false, error: insertErr.message });
              continue;
            }
          }

          // Mark as accepted
          await supabase
            .from('company_research_suggestions')
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
            })
            .eq('id', id);

          results.push({ id, success: true });
        } catch (err) {
          results.push({ id, success: false, error: err instanceof Error ? err.message : String(err) });
        }
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
