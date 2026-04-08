import express, { type Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { mountServerRoutes } from "../../server/register-routes.js";

const okHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({ ok: true });
};

const createRouter = (): Router => {
  const router = express.Router();
  router.get("/ping", okHandler);
  return router;
};

function registerRoutesForTest(app: express.Application): void {
  const apiRouter = express.Router();
  const healthRouter = express.Router();
  healthRouter.get("/health", okHandler);

  mountServerRoutes({
    app,
    apiRouter,
    healthRouter,
    serviceIdentityMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    getMetricsRegistry: null,
    getLatencySnapshot: null,
    cspReportHandler: (_req: express.Request, res: express.Response) => res.status(204).end(),
    secretHealthMiddleware: () => (_req: express.Request, res: express.Response) => res.status(200).json({ status: "ok" }),
    serveMcpCapabilitiesDocument: (_req: express.Request, res: express.Response) => res.status(200).json({ version: 1 }),
    rateLimiters: {
      standard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      auth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    },
    requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    requireTenantRequestAlignment: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    tenantContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    tenantDbContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    billingAccessEnforcement: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    agentExecutionLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    agentsConcurrencyGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    groundtruthConcurrencyGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    llmConcurrencyGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    onboardingConcurrencyGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    appTrpcMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    academyTrpcMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    createCheckpointRouter: () => createRouter(),
    createApprovalWebhookRouter: () => createRouter(),
    createServerSupabaseClient: () => ({
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: async () => ({ data: null }),
          }),
        }),
      }),
    }),
    ApprovalWebhookService: class {},
    NotificationActionSigner: class {},
    logger: { info: () => undefined },
    authRouter: createRouter(),
    adminRouter: createRouter(),
    agentAdminRouter: createRouter(),
    securityMonitoringRouter: createRouter(),
    complianceRouter: createRouter(),
    agentsRouter: createRouter(),
    groundtruthRouter: createRouter(),
    llmRouter: createRouter(),
    mcpDiscoveryRouter: createRouter(),
    workflowRouter: createRouter(),
    experienceRouter: createRouter(),
    experienceStreamRouter: createRouter(),
    documentRouter: createRouter(),
    docsApiRouter: createRouter(),
    artifactsRouter: createRouter(),
    referralsRouter: createRouter(),
    usageRouter: createRouter(),
    analyticsRouter: createRouter(),
    dsrRouter: createRouter(),
    teamsRouter: createRouter(),
    integrationsRouter: createRouter(),
    mcpIntegrationsRouter: createRouter(),
    crmRouter: createRouter(),
    valueDriversRouter: createRouter(),
    onboardingRouter: createRouter(),
    domainPacksRouter: createRouter(),
    valueGraphRouter: createRouter(),
    auditLogsRouter: createRouter(),
    valueCasesRouter: createRouter(),
    integrityRouter: createRouter(),
    valueGraphCaseRouter: createRouter(),
    realizationRouter: createRouter(),
    reasoningTracesRouter: createRouter(),
    valueCommitmentsRouter: createRouter(),
    opportunityValueGraphRouter: createRouter(),
    tenantContextRouter: createRouter(),
    secretAuditRouter: createRouter(),
    complianceEvidenceRouter: createRouter(),
    approvalInboxRouter: createRouter(),
    billingRouter: createRouter(),
    projectsRouter: createRouter(),
    initiativesRouter: createRouter(),
    tenantContextRouterV1: createRouter(),
  });
}

describe("register-routes", () => {
  it("mounts core health and auth routes", async () => {
    const app = express();
    registerRoutesForTest(app);

    await request(app).get("/health").expect(200);
    await request(app).get("/api/auth/ping").expect(200);
    await request(app).get("/api/billing/ping").expect(200);
    await request(app).get("/api/v1/tenant/context/ping").expect(200);
  });
});
