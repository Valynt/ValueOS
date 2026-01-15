/**
 * MSW Request Handlers
 *
 * Mock handlers for Ghost Mode. These provide synthetic data
 * when the backend is unreachable.
 */

import { http, HttpResponse, delay } from "msw";

export const handlers = [
  // Health check
  http.get("/api/health", () => {
    return HttpResponse.json({
      status: "ok",
      mode: "ghost",
      timestamp: new Date().toISOString(),
    });
  }),

  // User profile
  http.get("/api/user/me", () => {
    return HttpResponse.json({
      id: "ghost-user-001",
      email: "ghost@valueos.dev",
      name: "Ghost User",
      tier: "pro",
      tenant_id: "ghost-tenant",
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  // Agents list
  http.get("/api/agents", () => {
    return HttpResponse.json({
      agents: [
        {
          id: "ghost-agent-1",
          name: "Mock Agent Alpha",
          description: "A mock agent for UI development",
          status: "idle",
          capabilities: ["analysis", "generation"],
          created_at: new Date().toISOString(),
        },
        {
          id: "ghost-agent-2",
          name: "Mock Agent Beta",
          description: "Another mock agent for testing",
          status: "idle",
          capabilities: ["review", "optimization"],
          created_at: new Date().toISOString(),
        },
        {
          id: "ghost-agent-3",
          name: "Mock Agent Gamma",
          description: "Third mock agent",
          status: "busy",
          capabilities: ["planning", "execution"],
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Agent invocation
  http.post("/api/agents/:agentId/invoke", async ({ params, request }) => {
    await delay(500 + Math.random() * 1000);

    const body = await request.json().catch(() => ({}));

    return HttpResponse.json({
      id: `ghost-task-${Date.now()}`,
      agentId: params.agentId,
      status: "completed",
      input: body,
      result: {
        message:
          "This is a mock response from Ghost Mode. The real backend is unavailable.",
        data: {
          processed: true,
          items: [
            { id: 1, name: "Mock Item 1", value: 42 },
            { id: 2, name: "Mock Item 2", value: 84 },
          ],
        },
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // Settings
  http.get("/api/settings", () => {
    return HttpResponse.json({
      theme: "system",
      notifications: true,
      language: "en",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }),

  http.patch("/api/settings", async ({ request }) => {
    const updates = await request.json();
    return HttpResponse.json({
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }),

  // Feature flags
  http.get("/api/feature-flags", () => {
    return HttpResponse.json({
      flags: {
        "new-dashboard": true,
        "ai-suggestions": true,
        "beta-features": false,
        "ghost-mode-active": true,
      },
    });
  }),

  // Tenants
  http.get("/api/tenants", () => {
    return HttpResponse.json({
      tenants: [
        {
          id: "ghost-tenant",
          name: "Ghost Tenant",
          plan: "pro",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Analytics (return empty data)
  http.get("/api/analytics/*", () => {
    return HttpResponse.json({
      data: [],
      total: 0,
      period: "7d",
    });
  }),

  // Approvals
  http.get("/api/approvals", () => {
    return HttpResponse.json({
      approvals: [
        {
          id: "ghost-approval-1",
          type: "agent-action",
          status: "pending",
          description: "Mock approval request",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  http.post("/api/approvals/:id/approve", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "approved",
      approved_at: new Date().toISOString(),
    });
  }),

  http.post("/api/approvals/:id/reject", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "rejected",
      rejected_at: new Date().toISOString(),
    });
  }),

  // Business cases
  http.get("/api/business-cases", () => {
    return HttpResponse.json({
      cases: [
        {
          id: "ghost-case-1",
          title: "Mock Business Case",
          status: "draft",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Workflows
  http.get("/api/workflows", () => {
    return HttpResponse.json({
      workflows: [
        {
          id: "ghost-workflow-1",
          name: "Mock Workflow",
          status: "active",
          steps: 5,
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Catch-all for unhandled API requests
  http.all("/api/*", ({ request }) => {
    console.debug(`[Ghost Mode] Unhandled: ${request.method} ${request.url}`);
    return HttpResponse.json(
      {
        error: "Not mocked",
        message: "This endpoint is not mocked in Ghost Mode",
        path: new URL(request.url).pathname,
      },
      { status: 501 }
    );
  }),
];

export default handlers;
