import express, { type Application } from "express";
import type { Router } from "express";

export interface RouteMountingInput {
  app: Application;
  apiRouter: Router;
  healthRouter: Router;
  serviceIdentityMiddleware: unknown;
  getMetricsRegistry: null | (() => { contentType: string; metrics: () => Promise<string> });
  getLatencySnapshot: null | (() => unknown);
  cspReportHandler: unknown;
  secretHealthMiddleware: (input: { mode: "public" | "privileged" }) => unknown;
  serveMcpCapabilitiesDocument: unknown;
  rateLimiters: { standard: unknown; auth: unknown };
  requireAuth: unknown;
  requireTenantRequestAlignment: () => unknown;
  tenantContextMiddleware: () => unknown;
  tenantDbContextMiddleware: () => unknown;
  billingAccessEnforcement: unknown;
  agentExecutionLimiter: unknown;
  agentsConcurrencyGuard: unknown;
  groundtruthConcurrencyGuard: unknown;
  llmConcurrencyGuard: unknown;
  onboardingConcurrencyGuard: unknown;
  appTrpcMiddleware: unknown;
  academyTrpcMiddleware: unknown;
  createCheckpointRouter: (input: unknown) => Router;
  createApprovalWebhookRouter: (input: unknown) => Router;
  createServerSupabaseClient: () => { from: (name: string) => { update: (payload: unknown) => { eq: (key: string, value: unknown) => { eq: (key: string, value: unknown) => Promise<unknown> } } } };
  ApprovalWebhookService: new (input: unknown) => unknown;
  NotificationActionSigner: new (input: { secret: string }) => unknown;
  logger: { info: (msg: string, payload?: unknown) => void };
  authRouter: Router;
  adminRouter: Router;
  agentAdminRouter: Router;
  securityMonitoringRouter: Router;
  complianceRouter: Router;
  agentsRouter: Router;
  groundtruthRouter: Router;
  llmRouter: Router;
  mcpDiscoveryRouter: Router;
  workflowRouter: Router;
  experienceRouter: Router;
  experienceStreamRouter: Router;
  documentRouter: Router;
  docsApiRouter: Router;
  artifactsRouter: Router;
  referralsRouter: Router;
  usageRouter: Router;
  analyticsRouter: Router;
  dsrRouter: Router;
  teamsRouter: Router;
  integrationsRouter: Router;
  mcpIntegrationsRouter: Router;
  crmRouter: Router;
  valueDriversRouter: Router;
  onboardingRouter: Router;
  domainPacksRouter: Router;
  valueGraphRouter: Router;
  auditLogsRouter: Router;
  valueCasesRouter: Router;
  integrityRouter: Router;
  valueGraphCaseRouter: Router;
  realizationRouter: Router;
  reasoningTracesRouter: Router;
  valueCommitmentsRouter: Router;
  opportunityValueGraphRouter: Router;
  tenantContextRouter: Router;
  secretAuditRouter: Router;
  complianceEvidenceRouter: Router;
  approvalInboxRouter: Router;
  billingRouter: Router;
  projectsRouter: Router;
  initiativesRouter: Router;
  tenantContextRouterV1: Router;
}

export function mountServerRoutes(input: RouteMountingInput): void {
  input.app.use(input.healthRouter);

  if (input.getMetricsRegistry) {
    input.app.get("/metrics", input.serviceIdentityMiddleware as never, async (_req, res) => {
      const registry = input.getMetricsRegistry!();
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    });
  }

  if (typeof input.getLatencySnapshot === "function") {
    input.app.get("/metrics/latency", input.serviceIdentityMiddleware as never, (_req, res) => {
      res.json({
        routes: input.getLatencySnapshot!(),
        timestamp: new Date().toISOString(),
      });
    });
  }

  input.app.post(
    "/api/csp-report",
    express.json({ type: "application/csp-report" }),
    input.cspReportHandler as never
  );

  input.app.get("/health/secrets/public", input.secretHealthMiddleware({ mode: "public" }) as never);
  input.app.get(
    "/health/secrets",
    input.serviceIdentityMiddleware as never,
    input.secretHealthMiddleware({ mode: "privileged" }) as never
  );

  input.app.get("/.well-known/mcp-capabilities.json", input.serveMcpCapabilitiesDocument as never);

  input.app.use("/api", input.rateLimiters.standard as never);
  input.app.use("/api/auth", input.rateLimiters.auth as never);

  input.apiRouter.use("/billing", input.billingRouter);
  input.apiRouter.use("/tenant/context", input.tenantContextRouter);
  input.apiRouter.use("/projects", input.requireAuth as never, input.tenantContextMiddleware() as never, input.projectsRouter);
  input.apiRouter.use(
    "/initiatives",
    input.requireAuth as never,
    input.tenantContextMiddleware() as never,
    input.tenantDbContextMiddleware() as never,
    input.initiativesRouter
  );

  input.app.use("/api", input.apiRouter);
  input.app.use("/api/auth", input.authRouter);
  input.app.use("/api/admin", input.adminRouter);
  input.app.use("/api/admin/agents", input.agentAdminRouter);
  input.app.use("/api/admin/security", input.securityMonitoringRouter);
  input.app.use("/api/admin/compliance", input.complianceRouter);

  input.app.use(
    "/api/agents",
    input.serviceIdentityMiddleware as never,
    input.requireAuth as never,
    input.requireTenantRequestAlignment() as never,
    input.tenantContextMiddleware() as never,
    input.tenantDbContextMiddleware() as never,
    input.billingAccessEnforcement as never,
    input.agentExecutionLimiter as never,
    input.agentsConcurrencyGuard as never,
    input.agentsRouter
  );

  input.app.use(
    "/api/groundtruth",
    input.serviceIdentityMiddleware as never,
    input.requireAuth as never,
    input.requireTenantRequestAlignment() as never,
    input.tenantContextMiddleware() as never,
    input.tenantDbContextMiddleware() as never,
    input.billingAccessEnforcement as never,
    input.agentExecutionLimiter as never,
    input.groundtruthConcurrencyGuard as never,
    input.groundtruthRouter
  );

  input.app.use("/api/llm", input.llmConcurrencyGuard as never, input.llmRouter);
  input.app.use("/api/mcp", input.mcpDiscoveryRouter);
  input.app.use("/api", input.workflowRouter);
  input.app.use("/api", input.experienceRouter);
  input.app.use("/api", input.experienceStreamRouter);
  input.app.use(
    "/api/documents",
    input.requireAuth as never,
    input.requireTenantRequestAlignment() as never,
    input.tenantContextMiddleware() as never,
    input.tenantDbContextMiddleware() as never,
    input.documentRouter
  );
  input.app.use("/api/docs", input.docsApiRouter);
  input.app.use("/api", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.artifactsRouter);
  input.app.use("/api/referrals", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.tenantDbContextMiddleware() as never, input.referralsRouter);
  input.app.use("/api/usage", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.tenantDbContextMiddleware() as never, input.usageRouter);
  input.app.use("/api/analytics", input.analyticsRouter);
  input.app.use("/api/dsr", input.dsrRouter);
  input.app.use("/api/teams", input.teamsRouter);
  input.app.use("/api/integrations", input.integrationsRouter);
  input.app.use("/api/mcp-integrations", input.mcpIntegrationsRouter);
  input.app.use("/api/crm", input.crmRouter);
  input.app.use("/api/value-drivers", input.valueDriversRouter);
  input.app.use("/api/onboarding", input.onboardingConcurrencyGuard as never, input.onboardingRouter);
  input.app.use("/api/v1/domain-packs", input.domainPacksRouter);
  input.app.use("/api/v1/graph", input.valueGraphRouter);
  input.app.use("/api/v1/audit-logs", input.auditLogsRouter);
  input.app.use("/api/v1/cases", input.valueCasesRouter);
  input.app.use("/api/v1/cases", input.integrityRouter);
  input.app.use("/api/v1/value-cases", input.valueCasesRouter);
  input.app.use("/api/v1/cases", input.valueGraphCaseRouter);
  input.app.use("/api", input.realizationRouter);
  input.app.use("/api/v1", input.reasoningTracesRouter);
  input.app.use("/api/v1/value-commitments", input.valueCommitmentsRouter);
  input.app.use("/api/v1/opportunities", input.opportunityValueGraphRouter);
  input.app.use("/api/v1/tenant/context", input.tenantContextRouterV1);
  input.app.use("/api/v1", input.requireAuth as never, input.tenantContextMiddleware() as never, input.secretAuditRouter);
  input.app.use("/api/compliance/evidence", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.complianceEvidenceRouter);
  input.app.use("/api/approval-inbox", input.approvalInboxRouter);
  input.app.use("/api/trpc", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.appTrpcMiddleware as never);
  input.app.use("/api/academy", input.requireAuth as never, input.requireTenantRequestAlignment() as never, input.tenantContextMiddleware() as never, input.academyTrpcMiddleware as never);

  const checkpointMiddleware = null;
  if (checkpointMiddleware) {
    input.app.use("/api/checkpoints", input.requireAuth as never, input.tenantContextMiddleware() as never, input.createCheckpointRouter(checkpointMiddleware));

    const approvalActionSecret = process.env.APPROVAL_ACTION_SECRET;
    const approvalWebhookSecret = process.env.APPROVAL_WEBHOOK_SECRET;
    if (!approvalActionSecret || !approvalWebhookSecret) {
      throw new Error(
        "APPROVAL_ACTION_SECRET and APPROVAL_WEBHOOK_SECRET must be set. " +
          "These secrets protect approval webhook signatures and must not use defaults."
      );
    }

    const signer = new input.NotificationActionSigner({ secret: approvalActionSecret });
    const supabaseClient = input.createServerSupabaseClient();
    const webhookService = new input.ApprovalWebhookService({
      signer,
      checkpointMiddleware,
      webhookSigningSecret: approvalWebhookSecret,
      transitionApprovalRequest: async ({
        requestId,
        tenantId,
        approved,
        actorId,
        reason,
      }: {
        requestId: string;
        tenantId: string;
        approved: boolean;
        actorId: string;
        reason?: string;
      }) => {
        await supabaseClient
          .from("approval_requests")
          .update({
            status: approved ? "approved" : "rejected",
            updated_at: new Date().toISOString(),
            metadata: {
              decision_source: "webhook",
              actor_id: actorId,
              reason: reason || null,
            },
          })
          .eq("id", requestId)
          .eq("tenant_id", tenantId);
      },
      audit: async (event: string, details: unknown) => {
        input.logger.info(`approval_webhook:${event}`, details);
      },
    });

    input.app.use("/api/approvals/webhooks", input.createApprovalWebhookRouter(webhookService));
  }
}
