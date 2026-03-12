import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors";
import { asyncHandler } from "../middleware/globalErrorHandler.js";
import {
  getTenantIdFromRequest,
  ReadThroughCacheService,
} from "../services/ReadThroughCacheService.js";

const router = Router();

const projectStatuses = ["planned", "active", "paused", "completed"] as const;

const projectCreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  status: z.enum(projectStatuses).default("planned"),
  tags: z.array(z.string().min(1).max(32)).max(20).optional(),
});

const projectUpdateSchema = projectCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(projectStatuses).optional(),
  search: z.string().min(1).max(120).optional(),
});

type ProjectStatus = (typeof projectStatuses)[number];

interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  tags: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Temporary in-process store partitioned by tenant. Replace with a durable
// Supabase-backed repository (projects table + organization_id filter) before GA.
const projectsByTenant = new Map<string, Map<string, ProjectRecord>>();

function getTenantStore(req: Request): Map<string, ProjectRecord> {
  const tenantId = getTenantIdFromRequest(req as any);
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  let store = projectsByTenant.get(tenantId);
  if (!store) {
    store = new Map<string, ProjectRecord>();
    projectsByTenant.set(tenantId, store);
  }
  return store;
}

function requireBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Bearer token required");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Bearer token required");
  }

  return token;
}

function requireWriteRole(req: Request, allowedRoles: string[]): void {
  // Role must come from verified JWT claims, not client-supplied headers.
  const user = (req as any).user as Record<string, unknown> | undefined;
  const role =
    (user?.role as string | undefined) ??
    (user?.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
  if (!role || !allowedRoles.includes(role)) {
    throw new ForbiddenError("Insufficient permissions for this action");
  }
}

function deriveOwnerId(req: Request): string {
  // Owner is the authenticated user's ID from JWT claims, never a header.
  return ((req as any).user?.id as string | undefined) ?? "unknown-user";
}

async function invalidateProjectCache(req: Request): Promise<void> {
  const tenantId = getTenantIdFromRequest(req as any);
  if (!tenantId) return;
  await Promise.all([
    ReadThroughCacheService.invalidateEndpoint(tenantId, "api-projects-list"),
    ReadThroughCacheService.invalidateEndpoint(tenantId, "api-projects-detail"),
  ]);
}

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin", "editor"]);

    const payload = projectCreateSchema.parse(req.body);
    const normalizedName = payload.name.toLowerCase();

    const tenantStore = getTenantStore(req);
    const existing = Array.from(tenantStore.values()).find(
      (project) => project.name.toLowerCase() === normalizedName
    );

    if (existing) {
      throw new ConflictError("Project name already exists");
    }

    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: `proj_${uuidv4()}`,
      name: payload.name,
      description: payload.description,
      status: payload.status,
      tags: payload.tags ?? [],
      ownerId: deriveOwnerId(req),
      createdAt: now,
      updatedAt: now,
    };

    tenantStore.set(project.id, project);
    await invalidateProjectCache(req);

    res.status(201).json({ data: project });
  })
);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);

    const { page, pageSize, status, search } = listQuerySchema.parse(req.query);
    // getTenantStore throws UnauthorizedError when tenant is absent, guaranteeing
    // a non-undefined tenantId for the cache key before getOrLoad is called.
    const tenantStore = getTenantStore(req);
    const tenantId = getTenantIdFromRequest(req as any) as string;

    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-projects-list",
        scope: "list",
        tier: "warm",
        keyPayload: { page, pageSize, status, search },
      },
      async () => {
        const allProjects = Array.from(tenantStore.values());
        const filtered = allProjects.filter((project) => {
          if (status && project.status !== status) {
            return false;
          }

          if (search) {
            const lowerSearch = search.toLowerCase();
            return (
              project.name.toLowerCase().includes(lowerSearch) ||
              project.description?.toLowerCase().includes(lowerSearch)
            );
          }

          return true;
        });

        const start = (page - 1) * pageSize;
        const items = filtered.slice(start, start + pageSize);

        return {
          data: {
            items,
            page,
            pageSize,
            total: filtered.length,
          },
        };
      }
    );

    res.json(payload);
  })
);

router.get(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);

    // getTenantStore throws UnauthorizedError when tenant is absent, guaranteeing
    // a non-undefined tenantId for the cache key before getOrLoad is called.
    const tenantStore = getTenantStore(req);
    const tenantId = getTenantIdFromRequest(req as any) as string;
    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-projects-detail",
        scope: req.params.projectId,
        tier: "cold",
      },
      async () => {
        const project = tenantStore.get(req.params.projectId);
        if (!project) {
          throw new NotFoundError("Project", req.params.projectId);
        }

        return { data: project };
      }
    );

    res.json(payload);
  })
);

router.patch(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin", "editor"]);

    const tenantStore = getTenantStore(req);
    const existing = tenantStore.get(req.params.projectId);
    if (!existing) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    const payload = projectUpdateSchema.parse(req.body);
    const updated: ProjectRecord = {
      ...existing,
      ...payload,
      tags: payload.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };

    tenantStore.set(updated.id, updated);
    await invalidateProjectCache(req);

    res.json({ data: updated });
  })
);

router.delete(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin"]);

    const tenantStore = getTenantStore(req);
    const exists = tenantStore.has(req.params.projectId);
    if (!exists) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    tenantStore.delete(req.params.projectId);
    await invalidateProjectCache(req);

    res.status(204).send();
  })
);

export { router as projectsRouter };
