import { Router } from "express";

import { getRequestSupabaseClient } from "../lib/supabase.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger({ component: "TenantApiRouter" });

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  role: string;
  status: "active" | "inactive" | "pending";
  createdAt: string;
}

interface TenantMembershipRow {
  tenant_id: string;
  role: string;
  status: TenantInfo["status"];
  tenants?: {
    id: string;
    name?: string;
    slug?: string;
    settings?: { brandColor?: string };
    created_at?: string;
  };
}

const isSafeTenantId = (tenantId: string): boolean => /^[a-zA-Z0-9_-]{1,128}$/.test(tenantId);

export const tenantRouter = Router();

tenantRouter.get("/memberships", async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ data: null, error: "Unauthorized" });
  }

  try {
    const db = getRequestSupabaseClient(req);
    const { data, error } = await db
      .from("user_tenants")
      .select(
        `
        tenant_id,
        role,
        status,
        tenants:tenant_id (
          id,
          name,
          slug,
          settings,
          created_at
        )
      `
      )
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      logger.error("Failed to fetch tenant memberships", error, { userId });
      return res.status(500).json({ data: null, error: "Failed to fetch tenant memberships" });
    }

    const tenants: TenantInfo[] = (data as TenantMembershipRow[] | null)?.map((row) => ({
      id: row.tenant_id,
      name: row.tenants?.name ?? "Unknown Tenant",
      slug: row.tenants?.slug ?? row.tenant_id,
      color: row.tenants?.settings?.brandColor ?? "#18C3A5",
      role: row.role || "member",
      status: row.status,
      createdAt: row.tenants?.created_at ?? new Date().toISOString(),
    })) ?? [];

    return res.json({ data: tenants, error: null });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error fetching tenant memberships";
    logger.error("Exception fetching tenant memberships", err as Error, { userId });
    return res.status(500).json({ data: null, error });
  }
});

tenantRouter.get("/:tenantId", async (req, res) => {
  const userId = req.user?.id;
  const { tenantId } = req.params;

  if (!userId) {
    return res.status(401).json({ data: null, error: "Unauthorized" });
  }

  if (!tenantId || !isSafeTenantId(tenantId)) {
    return res.status(400).json({ data: null, error: "Invalid tenant id" });
  }

  try {
    const db = getRequestSupabaseClient(req);

    const { data, error } = await db
      .from("user_tenants")
      .select(
        `
        tenant_id,
        role,
        status,
        tenants:tenant_id (
          id,
          name,
          slug,
          settings,
          created_at
        )
      `
      )
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      logger.warn("Failed to fetch tenant by id", { userId, tenantId, error });
      return res.status(404).json({ data: null, error: "Tenant not found" });
    }

    const row = data as TenantMembershipRow;
    const tenant: TenantInfo = {
      id: row.tenant_id,
      name: row.tenants?.name ?? "Unknown Tenant",
      slug: row.tenants?.slug ?? row.tenant_id,
      color: row.tenants?.settings?.brandColor ?? "#18C3A5",
      role: row.role || "member",
      status: row.status,
      createdAt: row.tenants?.created_at ?? new Date().toISOString(),
    };

    return res.json({ data: tenant, error: null });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error fetching tenant";
    logger.error("Exception fetching tenant", err as Error, { userId, tenantId });
    return res.status(500).json({ data: null, error });
  }
});
