import { Request, Response, Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors";
import { asyncHandler } from "../middleware/globalErrorHandler.js"

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

const projects = new Map<string, ProjectRecord>();

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
  const roleHeader = req.headers["x-user-role"];
  const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  if (!role || !allowedRoles.includes(role)) {
    throw new ForbiddenError("Insufficient permissions for this action");
  }
}

function deriveOwnerId(req: Request): string {
  const ownerHeader = req.headers["x-user-id"];
  const ownerId = Array.isArray(ownerHeader) ? ownerHeader[0] : ownerHeader;
  return ownerId?.trim() || "unknown-user";
}

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin", "editor"]);

    const payload = projectCreateSchema.parse(req.body);
    const normalizedName = payload.name.toLowerCase();

    const existing = Array.from(projects.values()).find(
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

    projects.set(project.id, project);

    res.status(201).json({ data: project });
  })
);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);

    const { page, pageSize, status, search } = listQuerySchema.parse(req.query);
    const allProjects = Array.from(projects.values());

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

    res.json({
      data: {
        items,
        page,
        pageSize,
        total: filtered.length,
      },
    });
  })
);

router.get(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);

    const project = projects.get(req.params.projectId);
    if (!project) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    res.json({ data: project });
  })
);

router.patch(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin", "editor"]);

    const existing = projects.get(req.params.projectId);
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

    projects.set(updated.id, updated);
    res.json({ data: updated });
  })
);

router.delete(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    requireBearerToken(req);
    requireWriteRole(req, ["admin"]);

    const exists = projects.has(req.params.projectId);
    if (!exists) {
      throw new NotFoundError("Project", req.params.projectId);
    }

    projects.delete(req.params.projectId);
    res.status(204).send();
  })
);

export default router;
