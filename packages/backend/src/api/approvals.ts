/**
 * Phase 2: Approval API Endpoints
 *
 * Handles approval workflow for agent actions requiring human oversight.
 */

import { getRequestSupabaseClient } from '@shared/lib/supabase';
import { Request, Response } from 'express';

import { auditBulkDelete } from '../middleware/auditHooks.js'
import { requireAuth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { createSecureRouter } from '../middleware/secureRouter.js'
import { tenantContextMiddleware } from '../middleware/tenantContext.js'
import { logger } from '../utils/logger.js'

const router = createSecureRouter("strict");
router.use(requireAuth, tenantContextMiddleware());

const withRequestContext = (req: Request, meta?: Record<string, unknown>) => ({
  requestId: req.requestId,
  ...meta,
});

/**
 * POST /api/approvals/request
 * Create a new approval request
 */
router.post('/request', requirePermission('approvals:create'), async (req: Request, res: Response) => {
  try {
    const {
      agentName,
      action,
      description,
      estimatedCost,
      isDestructive,
      involvesDataExport,
      metadata,
    } = req.body;

    // Validate required fields
    if (!agentName || !action) {
      return res.status(400).json({
        error: 'Missing required fields: agentName, action',
      });
    }

    const supabase = getRequestSupabaseClient(req);

    // Create approval request via database function
    const { data, error } = await supabase.rpc('create_approval_request', {
      p_agent_name: agentName,
      p_action: action,
      p_description: description || '',
      p_estimated_cost: estimatedCost || 0,
      p_is_destructive: isDestructive || false,
      p_involves_data_export: involvesDataExport || false,
      p_metadata: metadata || {},
    });

    if (error) {
      logger.error('Error creating approval request', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to create approval request' });
    }

    return res.status(202).json({
      message: 'Approval request created',
      requestId: data,
      status: 'pending',
    });
  } catch (error) {
    logger.error('Approval request error', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/approvals/pending
 * Get all pending approval requests (for approvers)
 */
router.get('/pending', requirePermission('approvals:manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const supabase = getRequestSupabaseClient(req);

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching pending approvals', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }

    return res.json({ requests: data || [] });
  } catch (error) {
    logger.error('Error fetching pending approvals', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/approvals/my-requests
 * Get current user's approval requests
 */
router.get('/my-requests', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const supabase = getRequestSupabaseClient(req);

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*, approvals(*)')
      .eq('tenant_id', tenantId)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user requests', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }

    return res.json({ requests: data || [] });
  } catch (error) {
    logger.error('Error fetching user requests', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/approvals/:requestId/approve
 * Approve an approval request
 */
router.post('/:requestId/approve', requirePermission('approvals:manage'), async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { secondApproverEmail, notes } = req.body;

    const supabase = getRequestSupabaseClient(req);

    // Approve via database function
    const { data, error } = await supabase.rpc('approve_request', {
      p_request_id: requestId,
      p_second_approver_email: secondApproverEmail || null,
      p_notes: notes || null,
    });

    if (error) {
      // Map known DB error patterns to user-facing messages without leaking internals
      if (error.message.includes('dual control')) {
        return res.status(400).json({
          error: 'Dual control required',
          message: 'This request requires a second approver email',
        });
      }

      if (error.message.includes('permission')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have permission to approve this request',
        });
      }

      if (error.message.includes('expired')) {
        return res.status(410).json({
          error: 'Request expired',
          message: 'This approval request has expired',
        });
      }

      logger.error('Error approving request', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to approve request' });
    }

    return res.json({
      message: 'Request approved',
      success: data,
    });
  } catch (error) {
    logger.error('Error approving request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/approvals/:requestId/reject
 * Reject an approval request
 */
router.post('/:requestId/reject', requirePermission('approvals:manage'), async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;

    const supabase = getRequestSupabaseClient(req);

    // Reject via database function
    const { data, error } = await supabase.rpc('reject_request', {
      p_request_id: requestId,
      p_notes: notes || null,
    });

    if (error) {
      logger.error('Error rejecting request', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to reject request' });
    }

    return res.json({
      message: 'Request rejected',
      success: data,
    });
  } catch (error) {
    logger.error('Error rejecting request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/approvals/:requestId
 * Get details of a specific approval request
 */
router.get('/:requestId', requirePermission('approvals:view'), async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const supabase = getRequestSupabaseClient(req);

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*, approvals(*)')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Request not found' });
      }
      logger.error('Error fetching request', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to fetch request' });
    }

    return res.json({ request: data });
  } catch (error) {
    logger.error('Error fetching request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/approvals/:requestId
 * Cancel a pending approval request (requester only; enforced by tenant + requester_id filter in DB)
 */
router.delete('/:requestId', requirePermission('approvals:create'), auditBulkDelete('approval_request'), async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const supabase = getRequestSupabaseClient(req);

    // Only allow cancellation of pending requests within the tenant
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    if (error) {
      logger.error('Error cancelling request', error, withRequestContext(req));
      return res.status(500).json({ error: 'Failed to cancel request' });
    }

    return res.json({ message: 'Request cancelled' });
  } catch (error) {
    logger.error('Error cancelling request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
