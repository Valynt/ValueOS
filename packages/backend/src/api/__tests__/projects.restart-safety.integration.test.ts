import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  status: "planned" | "active" | "paused" | "completed";
  tags: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

const durableStore = new Map<string, Map<string, ProjectRow>>();

function tenantStore(tenantId: string): Map<string, ProjectRow> {
  const existing = durableStore.get(tenantId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, ProjectRow>();
  durableStore.set(tenantId, created);
  return created;
}

vi.mock("../../services/cache/ReadThroughCacheService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/cache/ReadThroughCacheService.js")>();
  return {
    ...actual,
    ReadThroughCacheService: {
      getOrLoad: vi.fn((_config: unknown, loader: () => Promise<unknown>) => loader()),
      invalidateEndpoint: vi.fn().mockResolvedValue(0),
    },
  };
});

vi.mock("../../services/security/index.js", () => ({
  auditLogService: { createEntry: vi.fn().mockResolvedValue({ id: "audit-1" }) },
}));

vi.mock("../../repositories/ProjectRepository.js", () => ({
  projectRepository: {
    findByName: vi.fn(async (organizationId: string, normalizedName: string) => {
      return (
        Array.from(tenantStore(organizationId).values()).find(
          (project) => project.normalized_name === normalizedName,
        ) ?? null
      );
    }),
    create: vi.fn(
      async (input: {
        id: string;
        organizationId: string;
        name: string;
        description?: string;
        status: "planned" | "active" | "paused" | "completed";
        tags: string[];
        ownerId: string;
      }) => {
        const now = new Date().toISOString();
        const row: ProjectRow = {
          id: input.id,
          organization_id: input.organizationId,
          name: input.name,
          normalized_name: input.name.trim().toLowerCase(),
          description: input.description ?? null,
          status: input.status,
          tags: input.tags,
          owner_id: input.ownerId,
          created_at: now,
          updated_at: now,
        };
        tenantStore(input.organizationId).set(row.id, row);
        return row;
      },
    ),
    list: vi.fn(async (organizationId: string) => {
      const items = Array.from(tenantStore(organizationId).values());
      return { items, total: items.length };
    }),
    getById: vi.fn(async (organizationId: string, projectId: string) => {
      return tenantStore(organizationId).get(projectId) ?? null;
    }),
    update: vi.fn(),
    delete: vi.fn(),
  },
  projectStatuses: ["planned", "active", "paused", "completed"],
}));

import { projectsRouter } from "../projects.js";

function buildApp(tenantId: string): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const reqWithContext = req as typeof req & {
      tenantId?: string;
      user?: { id: string; role: string };
    };
    reqWithContext.tenantId = tenantId;
    reqWithContext.user = { id: `user-${tenantId}`, role: "admin" };
    next();
  });
  app.use("/api/projects", projectsRouter);
  return app;
}

const authHeader = { Authorization: "Bearer test-token" };

describe("Projects API — restart safety", () => {
  beforeEach(() => {
    durableStore.clear();
  });

  it("retains tenant-visible records across app reinitialization", async () => {
    const firstBoot = buildApp("tenant-restart");
    const createRes = await request(firstBoot)
      .post("/api/projects")
      .set(authHeader)
      .send({ name: "Durable Project" })
      .expect(201);

    const secondBoot = buildApp("tenant-restart");
    await request(secondBoot)
      .get(`/api/projects/${createRes.body.data.id as string}`)
      .set(authHeader)
      .expect(200);
  });

  it("keeps tenant boundaries intact after app restart", async () => {
    const tenantBApp = buildApp("tenant-b");
    const createRes = await request(tenantBApp)
      .post("/api/projects")
      .set(authHeader)
      .send({ name: "Tenant B Only" })
      .expect(201);

    const tenantARestarted = buildApp("tenant-a");
    await request(tenantARestarted)
      .get(`/api/projects/${createRes.body.data.id as string}`)
      .set(authHeader)
      .expect(404);
  });
});
