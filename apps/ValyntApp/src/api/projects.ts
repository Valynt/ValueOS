import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { Logger } from "../utils/logger";
import { requestSanitizationMiddleware } from "../middleware/requestSanitizationMiddleware";

const router = Router({ mergeParams: true });
const logger = new Logger({ component: "ProjectsAPI" });

router.use(requestSanitizationMiddleware({
  params: { projectId: { maxLength: 128 }, tenantId: { maxLength: 128 } },
}));

// Map backend Initiative to frontend Project
const mapInitiativeToProject = (initiative: any) => ({
  id: initiative.id,
  workspaceId: initiative.tenant_id,
  name: initiative.name,
  description: initiative.description,
  status: initiative.status === 'archived' ? 'archived' : 'active',
  createdAt: initiative.created_at,
  updatedAt: initiative.updated_at,
});

// GET / - List projects
router.get("/", async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId || req.params.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: "Tenant context required" });
  }

  try {
    // If supabase client is null (e.g. env vars missing), return empty or error
    if (!supabase) {
      logger.warn("Supabase client not initialized");
      return res.json({ projects: [] });
    }

    const { data, error } = await supabase
      .from("initiatives")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const projects = (data || []).map(mapInitiativeToProject);
    res.json({ projects });
  } catch (error) {
    logger.error("Failed to fetch projects", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST / - Create project
router.post("/", requestSanitizationMiddleware({
  body: {
    description: {
      allowHtml: true,
      allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
      allowedAttributes: { a: ["href", "target", "rel"] },
      maxLength: 5000,
    },
  },
}), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId || req.params.tenantId;
  const user = (req as any).user;

  if (!tenantId || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Project name is required" });
  }

  try {
    if (!supabase) {
        throw new Error("Supabase client not initialized");
    }

    const newInitiative = {
      tenant_id: tenantId,
      name,
      description,
      status: "active",
      category: "growth", // Default category
      priority: 3, // Default priority (medium)
      owner_email: user.email,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data, error } = await supabase
      .from("initiatives")
      .insert(newInitiative)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(mapInitiativeToProject(data));
  } catch (error) {
    logger.error("Failed to create project", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to create project" });
  }
});

// PUT /:projectId - Update project
router.put("/:projectId", requestSanitizationMiddleware({
  body: {
    description: {
      allowHtml: true,
      allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
      allowedAttributes: { a: ["href", "target", "rel"] },
      maxLength: 5000,
    },
  },
  params: { projectId: { maxLength: 128 } },
}), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId || req.params.tenantId;
  const { projectId } = req.params;
  const { name, description, status } = req.body;

  try {
    if (!supabase) {
        throw new Error("Supabase client not initialized");
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
      updated_by: (req as any).user?.id,
    };

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status) {
      // Map frontend status to backend status
      if (status === 'completed' || status === 'archived') {
        updates.status = 'archived';
      } else {
        updates.status = 'active';
      }
    }

    const { data, error } = await supabase
      .from("initiatives")
      .update(updates)
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(mapInitiativeToProject(data));
  } catch (error) {
    logger.error("Failed to update project", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /:projectId - Delete project
router.delete("/:projectId", async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId || req.params.tenantId;
  const { projectId } = req.params;

  try {
    if (!supabase) {
        throw new Error("Supabase client not initialized");
    }

    const { error } = await supabase
      .from("initiatives")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    logger.error("Failed to delete project", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
