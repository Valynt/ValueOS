/**
 * Billing Overrides API
 *
 * POST   /api/billing/overrides          — request a new override
 * GET    /api/billing/overrides          — list overrides for the tenant
 * POST   /api/billing/overrides/:id/approve — approve a pending override (admin)
 * GET    /api/billing/reconciliation     — finance reconciliation export (CSV or JSON)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { supabase } from '../../lib/supabase.js';
import { createLogger } from '../../lib/logger.js';
import {
  billingOverridesService,
  CreateOverrideInputSchema,
} from '../../services/billing/BillingOverridesService.js';

const router = Router();
const logger = createLogger({ component: 'billing/overrides' });

router.use(requireAuth, tenantContextMiddleware());

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId(req: Request): string | null {
  return req.tenantId ?? null;
}

function getUserId(req: Request): string {
  return req.user?.id ?? 'system';
}

// ── POST /overrides ───────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  if (!tenantId) { res.status(401).json({ error: 'Tenant context required' }); return; }

  const parsed = CreateOverrideInputSchema.safeParse({
    ...req.body,
    organizationId: tenantId,
    requestedBy: getUserId(req),
  });

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const override = await billingOverridesService.requestOverride(parsed.data);
    res.status(201).json({ success: true, data: override });
  } catch (err) {
    logger.error('Failed to request billing override', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to request override' });
  }
});

// ── GET /overrides ────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  if (!tenantId) { res.status(401).json({ error: 'Tenant context required' }); return; }

  try {
    const overrides = await billingOverridesService.listOverrides(tenantId);
    res.json({ success: true, data: overrides });
  } catch (err) {
    logger.error('Failed to list billing overrides', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to list overrides' });
  }
});

// ── POST /overrides/:id/approve ───────────────────────────────────────────────

router.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  if (!tenantId) { res.status(401).json({ error: 'Tenant context required' }); return; }

  const { id } = req.params;

  try {
    const override = await billingOverridesService.approveOverride(id, tenantId, getUserId(req));
    res.json({ success: true, data: override });
  } catch (err) {
    logger.error('Failed to approve billing override', { id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to approve override' });
  }
});

// ── GET /reconciliation ───────────────────────────────────────────────────────

const ReconciliationQuerySchema = z.object({
  period_start: z.string().datetime({ message: 'period_start must be ISO 8601' }),
  period_end: z.string().datetime({ message: 'period_end must be ISO 8601' }),
  format: z.enum(['json', 'csv']).default('json'),
});

router.get('/reconciliation', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  if (!tenantId) { res.status(401).json({ error: 'Tenant context required' }); return; }

  const parsed = ReconciliationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const { period_start, period_end, format } = parsed.data;

  try {
    // Fetch usage ledger rows for the period
    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('rated_ledger')
      .select('organization_id, metric, quantity, billed_amount, period_start, period_end, created_at')
      .eq('organization_id', tenantId)
      .gte('period_start', period_start)
      .lte('period_end', period_end)
      .order('period_start', { ascending: true });

    if (ledgerErr) throw new Error(ledgerErr.message);

    // Fetch active overrides for context
    const overrides = await billingOverridesService.getActiveOverrides(tenantId);

    const rows = (ledgerRows ?? []).map((r) => ({
      period: `${r.period_start as string} – ${r.period_end as string}`,
      tenant: tenantId,
      metric: r.metric as string,
      usage: r.quantity as number,
      billed_amount: r.billed_amount as number,
      has_override: overrides.some((o) => o.metric === r.metric),
    }));

    if (format === 'csv') {
      const header = 'period,tenant,metric,usage,billed_amount,has_override\n';
      const body = rows
        .map((r) =>
          [r.period, r.tenant, r.metric, r.usage, r.billed_amount, r.has_override].join(',')
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reconciliation-${period_start.slice(0, 10)}-${period_end.slice(0, 10)}.csv"`
      );
      res.send(header + body);
      return;
    }

    res.json({
      success: true,
      data: {
        tenantId,
        periodStart: period_start,
        periodEnd: period_end,
        rows,
        totalBilled: rows.reduce((sum, r) => sum + r.billed_amount, 0),
        activeOverrides: overrides.length,
      },
    });
  } catch (err) {
    logger.error('Reconciliation export failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Reconciliation export failed' });
  }
});

export default router;
