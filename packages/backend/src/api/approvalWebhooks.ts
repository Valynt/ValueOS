import { Request, Response, Router } from 'express';

import { ApprovalWebhookService } from '../services/approvals/ApprovalWebhookService.js';

export function createApprovalWebhookRouter(service: ApprovalWebhookService): Router {
  const router = Router();

  router.post('/:provider/decision', async (req: Request, res: Response) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : req.body?.token;
      const tenantId = req.body?.tenantId as string | undefined;
      const actorId = req.body?.actorId as string | undefined;

      if (!token || !tenantId || !actorId) {
        res.status(400).json({ error: 'Missing required fields: token, tenantId, actorId' });
        return;
      }

      const signature = req.header('x-vos-webhook-signature') || '';
      const timestamp = req.header('x-vos-webhook-timestamp') || '';
      const nonce = req.header('x-vos-webhook-nonce') || '';

      if (!signature || !timestamp || !nonce) {
        res.status(401).json({ error: 'Missing webhook signature headers' });
        return;
      }

      const result = await service.applyDecision({
        actionToken: token,
        actorId,
        tenantId,
        reason: req.body?.reason,
        signature,
        timestamp,
        nonce,
      });

      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to process approval webhook',
      });
    }
  });

  return router;
}
