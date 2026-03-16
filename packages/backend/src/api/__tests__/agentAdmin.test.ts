import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) =>
      next(),
}));

vi.mock("../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: {
    listAll: vi.fn(),
    setKilled: vi.fn(),
  },
}));

import { agentKillSwitchService } from "../../services/agents/AgentKillSwitchService.js";
import { agentAdminRouter } from "../agentAdmin.js";

const killSwitchMock = vi.mocked(agentKillSwitchService);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/agents", agentAdminRouter);
  return app;
}

describe("GET /api/admin/agents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns agent list", async () => {
    killSwitchMock.listAll.mockResolvedValue([
      { name: "opportunity-agent", policy_version: "v1", killed: false },
      { name: "target-agent", policy_version: "v1", killed: true },
    ]);
    const res = await request(buildApp()).get("/api/admin/agents");
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(2);
    expect(res.body.agents[1].killed).toBe(true);
  });

  it("returns 500 when service throws", async () => {
    killSwitchMock.listAll.mockRejectedValue(new Error("Redis down"));
    const res = await request(buildApp()).get("/api/admin/agents");
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

describe("POST /api/admin/agents/:name/kill-switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("kills an agent", async () => {
    killSwitchMock.setKilled.mockResolvedValue(undefined);
    const res = await request(buildApp())
      .post("/api/admin/agents/opportunity-agent/kill-switch")
      .send({ killed: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "opportunity-agent", killed: true });
    expect(killSwitchMock.setKilled).toHaveBeenCalledWith(
      "opportunity-agent",
      true,
    );
  });

  it("re-enables an agent", async () => {
    killSwitchMock.setKilled.mockResolvedValue(undefined);
    const res = await request(buildApp())
      .post("/api/admin/agents/target-agent/kill-switch")
      .send({ killed: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "target-agent", killed: false });
  });

  it("returns 400 when killed is not boolean", async () => {
    const res = await request(buildApp())
      .post("/api/admin/agents/opportunity-agent/kill-switch")
      .send({ killed: "yes" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when killed is missing", async () => {
    const res = await request(buildApp())
      .post("/api/admin/agents/opportunity-agent/kill-switch")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 500 when service throws", async () => {
    killSwitchMock.setKilled.mockRejectedValue(new Error("Redis down"));
    const res = await request(buildApp())
      .post("/api/admin/agents/opportunity-agent/kill-switch")
      .send({ killed: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
