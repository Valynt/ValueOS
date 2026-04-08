import express, { Router, type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { mountServerRoutes, type RouteMountingInput } from "./register-routes.js";

const noop: RequestHandler = (_req, _res, next) => next();

function createRouteInput(app: express.Express): RouteMountingInput {
  const apiRouter = Router();
  const healthRouter = Router();

  const authRouter = Router();
  authRouter.get("/ping", (_req, res) => res.status(200).json({ ok: true }));

  const valueCasesRouter = Router();
  valueCasesRouter.get("/ping", (_req, res) =>
    res.status(200).json({ route: "value-cases" })
  );

  const tenantContextRouter = Router();
  tenantContextRouter.get("/ping", (_req, res) =>
    res.status(200).json({ route: "tenant-context" })
  );

  healthRouter.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  return {
    app,
    apiRouter,
    healthRouter,
    serviceIdentityMiddleware: noop,
    getMetricsRegistry: null,
    getLatencySnapshot: null,
    cspReportHandler: noop,
    secretHealthMiddleware: () => noop,
    serveMcpCapabilitiesDocument: noop,
    rateLimiters: { standard: noop, auth: noop },
    requireAuth: noop,
    requireTenantRequestAlignment: () => noop,
    tenantContextMiddleware: () => noop,
    tenantDbContextMiddleware: () => noop,
    billingAccessEnforcement: noop,
    agentExecutionLimiter: noop,
    agentsConcurrencyGuard: noop,
    groundtruthConcurrencyGuard: noop,
    llmConcurrencyGuard: noop,
    onboardingConcurrencyGuard: noop,
    appTrpcMiddleware: noop,
    academyTrpcMiddleware: noop,
    createCheckpointRouter: () => Router(),
    createApprovalWebhookRouter: () => Router(),
    createServerSupabaseClient: () => ({
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: async () => ({}),
          }),
        }),
      }),
    }),
    ApprovalWebhookService: class ApprovalWebhookServiceMock {},
    NotificationActionSigner: class NotificationActionSignerMock {},
    logger: { info: () => undefined },
    authRouter,
    adminRouter: Router(),
    agentAdminRouter: Router(),
    securityMonitoringRouter: Router(),
    complianceRouter: Router(),
    agentsRouter: Router(),
    groundtruthRouter: Router(),
    llmRouter: Router(),
    mcpDiscoveryRouter: Router(),
    workflowRouter: Router(),
    experienceRouter: Router(),
    experienceStreamRouter: Router(),
    documentRouter: Router(),
    docsApiRouter: Router(),
    artifactsRouter: Router(),
    referralsRouter: Router(),
    usageRouter: Router(),
    analyticsRouter: Router(),
    dsrRouter: Router(),
    teamsRouter: Router(),
    integrationsRouter: Router(),
    mcpIntegrationsRouter: Router(),
    crmRouter: Router(),
    valueDriversRouter: Router(),
    onboardingRouter: Router(),
    domainPacksRouter: Router(),
    valueGraphRouter: Router(),
    auditLogsRouter: Router(),
    valueCasesRouter,
    integrityRouter: Router(),
    valueGraphCaseRouter: Router(),
    realizationRouter: Router(),
    reasoningTracesRouter: Router(),
    valueCommitmentsRouter: Router(),
    opportunityValueGraphRouter: Router(),
    tenantContextRouter,
    secretAuditRouter: Router(),
    complianceEvidenceRouter: Router(),
    approvalInboxRouter: Router(),
    billingRouter: Router(),
    projectsRouter: Router(),
    initiativesRouter: Router(),
    tenantContextRouterV1: tenantContextRouter,
  };
}

describe("mountServerRoutes", () => {
  it("preserves expected auth and v1 route mounts", async () => {
    const app = express();
    mountServerRoutes(createRouteInput(app));

    const authResponse = await request(app).get("/api/auth/ping");
    expect(authResponse.status).toBe(200);

    const valueCasesV1Response = await request(app).get("/api/v1/cases/ping");
    expect(valueCasesV1Response.status).toBe(200);

    const tenantContextV1Response = await request(app).get("/api/v1/tenant/context/ping");
    expect(tenantContextV1Response.status).toBe(200);

    const healthResponse = await request(app).get("/health");
    expect(healthResponse.status).toBe(200);
  });
});
