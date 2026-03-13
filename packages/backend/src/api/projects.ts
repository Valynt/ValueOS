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
import { auditLogService } from "../services/security/index.js";
import {
  projectRepository,
  projectStatuses,
  type ProjectRecord,
} from "../repositories/ProjectRepository.js";
import {
  getTenantIdFromRequest,
  ReadThroughCacheService,
} from "../services/ReadThroughCacheService.js";

const router = Router();

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

function getTenantId(req: Request): string {
  const tenantId = getTenantIdFromRequest(req as unknown as { tenantId?: string });
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  return tenantId;
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
  const user = (req as unknown as { user?: Record<string, unknown> }).user;
  const role =
    (user?.role as string | undefined) ??
    (user?.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
  if (!role || !allowedRoles.includes(role)) {
    throw new ForbiddenError("Insufficient permissions for this action");
  }
}

function deriveOwnerId(req: Request): string {
  // Owner is the authenticated user's ID from JWT claims, never a header.
  return ((req as unknown as { user?: { id?: string } }).user?.id as string | undefined) ?? "unknown-user";
}

async function invalidateProjectCache(req: Request): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) return;
  await Promise.all([
    ReadThroughCacheService.invalidateEndpoint(tenantId, "api-projects-list"),
    ReadThroughCacheService.invalidateEndpoint(tenantId, "api-projects-detail"),
  ]);
}

function toApiProject(project: ProjectRecord) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    status: project.status,
    tags: project.tags,
    ownerId: project.owner_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

async function writeProjectAuditLog(
  req: Request,
  action: "create" | "update" | "delete",
  projectId: string,
): Promise<void> {
  const user = (req as unknown as { user?: Record<string, unknown> }).user;
  const tenantId = getTenantId(req);
  await auditLogService.createEntry({
    userId: ((user?.id as string | undefined) ?? "unknown-user"),
    userName: ((user?.name as string | undefined) ?? "unknown-user"),
    userEmail: ((user?.email as string | undefined) ?? "unknown@example.com"),
    action,
    resourceType: "project",
    resourceId: projectId,
    details: {
      tenantId,
      actorId: (user?.id as string | undefined) ?? "unknown-user",
      correlationId: req.header("x-correlation-id") ?? req.header("x-request-id") ?? null,
      traceId: req.header("x-trace-id") ?? null,
      route: req.originalUrl,
      method: req.method,
    },
  });
}

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin", "editor"]);

    const payload = projectCreateSchema.parse(req.body);
    const normalizedName = payload.name.toLowerCase();

    const tenantId = getTenantId(req);
    const existing = await projectRepository.findByName(tenantId, normalizedName);

    if (existing) {
      throw new ConflictError("Project name already exists");
    }

    const project = await projectRepository.create({
      id: `proj_${uuidv4()}`,
      organizationId: tenantId,
      name: payload.name,
      description: payload.description,
      status: payload.status,
      tags: payload.tags ?? [],
      ownerId: deriveOwnerId(req),
    });

    await writeProjectAuditLog(req, "create", project.id);
    await invalidateProjectCache(req);

    res.status(201).json({ data: toApiProject(project) });
  })
);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);

    const { page, pageSize, status, search } = listQuerySchema.parse(req.query);
    const tenantId = getTenantId(req);

    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-projects-list",
        scope: "list",
        tier: "warm",
        keyPayload: { page, pageSize, status, search },
      },
      async () => {
        const { items, total } = await projectRepository.list(tenantId, {
          page,
          pageSize,
          status,
          search,
        });

        return {
          data: {
            items: items.map(toApiProject),
            page,
            pageSize,
            total,
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

    const tenantId = getTenantId(req);
    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-projects-detail",
        scope: req.params.projectId,
        tier: "cold",
      },
      async () => {
        const project = await projectRepository.getById(tenantId, req.params.projectId);
        if (!project) {
          throw new NotFoundError("Project", req.params.projectId);
        }

        return { data: toApiProject(project) };
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

    const tenantId = getTenantId(req);
    const existing = await projectRepository.getById(tenantId, req.params.projectId);
    if (!existing) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    const payload = projectUpdateSchema.parse(req.body);
    if (payload.name && payload.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await projectRepository.findByName(tenantId, payload.name.toLowerCase());
      if (duplicate && duplicate.id !== req.params.projectId) {
        throw new ConflictError("Project name already exists");
      }
    }

    const updated = await projectRepository.update(tenantId, req.params.projectId, {
      ...payload,
      tags: payload.tags ?? existing.tags,
      description: payload.description ?? existing.description ?? undefined,
    });

    if (!updated) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    await writeProjectAuditLog(req, "update", updated.id);
    await invalidateProjectCache(req);

    res.json({ data: toApiProject(updated) });
  })
);

router.delete(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin"]);

    const tenantId = getTenantId(req);
    const exists = await projectRepository.getById(tenantId, req.params.projectId);
    if (!exists) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    await projectRepository.delete(tenantId, req.params.projectId);
    await writeProjectAuditLog(req, "delete", req.params.projectId);
    await invalidateProjectCache(req);

    res.status(204).send();
  })
);

export { router as projectsRouter };
