/**
 * Phase 2: Approval API Endpoints
 * 
 * Handles approval workflow for agent actions requiring human oversight.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';
import { logger } from '../utils/logger';
import { auditBulkDelete } from '../middleware/auditHooks';

const router = Router();
router.use(requestAuditMiddleware());

// Initialize Supabase client (server-side)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const withRequestContext = (req: Request, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId,
  ...meta,
});

/**
 * POST /api/approvals/request
 * Create a new approval request
 */
router.post('/request', async (req: Request, res: Response) => {
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
      return res.status(500).json({ error: error.message });
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
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
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
    // In a real app, get user ID from authenticated session
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*, approvals(*)')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
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
router.post('/:requestId/approve', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { secondApproverEmail, notes } = req.body;

    // Approve via database function
    const { data, error } = await supabase.rpc('approve_request', {
      p_request_id: requestId,
      p_second_approver_email: secondApproverEmail || null,
      p_notes: notes || null,
    });

    if (error) {
      // Check for specific error messages
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

      return res.status(500).json({ error: error.message });
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
router.post('/:requestId/reject', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;

    // Reject via database function
    const { data, error } = await supabase.rpc('reject_request', {
      p_request_id: requestId,
      p_notes: notes || null,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
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
router.get('/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*, approvals(*)')
      .eq('id', requestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Request not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.json({ request: data });
  } catch (error) {
    logger.error('Error fetching request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/approvals/:requestId
 * Cancel a pending approval request
 */
router.delete('/:requestId', auditBulkDelete('approval_request'), async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    // Only allow cancellation of pending requests
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ message: 'Request cancelled' });
  } catch (error) {
    logger.error('Error cancelling request', error as Error, withRequestContext(req));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
