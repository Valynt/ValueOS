import type { Request, Response } from "express";

import { createRequestRlsSupabaseClient } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { AgentRegistry } from "../services/agents/AgentRegistry.js";
import { WorkflowExecutionStore } from "../services/workflows/WorkflowExecutionStore.js";
import { ApprovalInbox } from "../runtime/approval-inbox/index.js";
import { PolicyEngine } from "../runtime/policy-engine/index.js";

const router = createSecureRouter("strict");
router.use(requireAuth, tenantContextMiddleware());

function buildApprovalInbox(req: Request): ApprovalInbox {
  const supabase = createRequestRlsSupabaseClient(req);
  const policyEngine = new PolicyEngine({
    supabase,
    registry: new AgentRegistry(),
    serviceReadiness: () => ({
      message_broker_ready: true,
      queue_ready: true,
      memory_backend_ready: true,
      llm_gateway_ready: true,
      circuit_breaker_ready: true,
    }),
  });

  return new ApprovalInbox(policyEngine, new WorkflowExecutionStore(supabase));
}

router.get("/my", requirePermission("approvals:view"), async (req: Request, res: Response) => {
  const organizationId = req.tenantId;
  const principal = req.user?.id;

  if (!organizationId || !principal) {
    return res.status(400).json({ error: "Tenant and user principal are required" });
  }

  const approvalInbox = buildApprovalInbox(req);
  const approvals = await approvalInbox.getMyApprovals(organizationId, principal);
  return res.json({ approvals });
});

router.get("/team/:teamPrincipal", requirePermission("approvals:view"), async (req: Request, res: Response) => {
  const organizationId = req.tenantId;
  const teamPrincipal = req.params.teamPrincipal;

  if (!organizationId || !teamPrincipal) {
    return res.status(400).json({ error: "Tenant and team principal are required" });
  }

  const approvalInbox = buildApprovalInbox(req);
  const approvals = await approvalInbox.getTeamApprovals(organizationId, teamPrincipal);
  return res.json({ approvals });
});

router.get("/overdue-escalated", requirePermission("approvals:manage"), async (req: Request, res: Response) => {
  const organizationId = req.tenantId;

  if (!organizationId) {
    return res.status(400).json({ error: "Tenant is required" });
  }

  const approvalInbox = buildApprovalInbox(req);
  const approvals = await approvalInbox.getOverdueOrEscalatedApprovals(organizationId);
  return res.json({ approvals });
});

export { router as approvalInboxRouter };
