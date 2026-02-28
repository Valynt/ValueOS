import { Router } from 'express';

import { supabase } from '../../lib/supabase.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { BillingExecutionControlService } from '../../services/billing/BillingExecutionControlService.js';
import { TenantExecutionStateService } from '../../services/billing/TenantExecutionStateService.js';

const router = Router();

const executionStateService = new TenantExecutionStateService(supabase);
const executionControlService = new BillingExecutionControlService(supabase, executionStateService);

router.use(requireRole('admin'));

router.post('/override', async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.tenantId || authReq.user?.tenant_id;
    if (!organizationId || !authReq.user?.id) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
      ? req.body.reason.trim()
      : 'Manual override approved by administrator';

    await executionControlService.clearPauseWithOverride({
      organizationId,
      actorUserId: authReq.user.id,
      actorEmail: authReq.user.email ?? 'unknown@valueos.com',
      reason,
    });

    res.status(200).json({ success: true, organizationId, resumed: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear pause state',
    });
  }
});

router.post('/top-up', async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.tenantId || authReq.user?.tenant_id;
    if (!organizationId || !authReq.user?.id) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const topUpAmount = Number(req.body?.topUpAmount ?? 0);
    if (!Number.isFinite(topUpAmount) || topUpAmount <= 0) {
      res.status(400).json({ error: 'topUpAmount must be a positive number' });
      return;
    }

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
      ? req.body.reason.trim()
      : 'Daily spend top-up approved by administrator';

    await executionControlService.topUpAndResume({
      organizationId,
      actorUserId: authReq.user.id,
      actorEmail: authReq.user.email ?? 'unknown@valueos.com',
      topUpAmount,
      reason,
    });

    res.status(200).json({ success: true, organizationId, resumed: true, topUpAmount });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to top-up and clear pause state',
    });
  }
});

export default router;
