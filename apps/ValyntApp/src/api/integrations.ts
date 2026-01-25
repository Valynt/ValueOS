import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { settings } from "../config/settings";
import { PROVIDERS, Integration, IntegrationStatus } from "../integrations/types";
import { logger } from "../lib/logger";

const router = Router();

// Helper to get scoped supabase client
const getScopedSupabase = (req: Request) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) throw new Error("Missing authorization token");

  // Use VITE_ prefix as these are exposed in settings
  const url = settings.VITE_SUPABASE_URL;
  const key = settings.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const supabase = getScopedSupabase(req);

    // Fetch settings related to integrations
    // We assume keys are formatted as 'integration_{providerId}_config' or similar
    // Or we just fetch all settings and filter
    const { data: settingsData, error } = await supabase
      .from("settings")
      .select("*")
      .eq("scope", "organization")
      .eq("scope_id", tenantId)
      .like("key", "integration_%");

    if (error) {
      logger.error("Failed to fetch integration settings", error);
      return res.status(500).json({ error: "Failed to fetch integrations" });
    }

    // Map settings to integrations
    // We start with the list of known providers
    const integrations: Integration[] = PROVIDERS.map((provider) => {
      // Find if we have settings for this provider
      // Assumption: key pattern is `integration_{provider.id}_status` or existence of config
      // Let's assume `integration_{provider.id}` contains the config/status JSON

      const providerSetting = settingsData?.find((s) => s.key === `integration_${provider.id}`);

      let status: IntegrationStatus = "disconnected";
      let config = {};
      let connectedAt = undefined;
      let lastSyncAt = undefined;

      if (providerSetting) {
        try {
          // Parse value if it's a string, or use as is
          const value = typeof providerSetting.value === 'string'
            ? JSON.parse(providerSetting.value)
            : providerSetting.value;

          if (value && typeof value === 'object') {
             status = value.status || "connected"; // Default to connected if record exists?
             config = value.config || {};
             connectedAt = value.connectedAt;
             lastSyncAt = value.lastSyncAt;
          }
        } catch (e) {
          logger.warn(`Failed to parse setting for ${provider.id}`, e);
          status = "error";
        }
      }

      return {
        id: providerSetting?.id || `temp-${provider.id}`, // Use setting ID if available, else temp
        type: provider.type,
        provider: provider.id,
        name: provider.name,
        description: provider.description,
        icon: provider.icon,
        status,
        config,
        connectedAt,
        lastSyncAt,
      };
    });

    return res.json({ integrations });
  } catch (error) {
    logger.error("Error fetching integrations", error instanceof Error ? error : undefined);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:providerId/connect", async (req: Request, res: Response) => {
  // TODO: Implement actual connect logic
  return res.status(501).json({ message: "Not implemented" });
});

router.delete("/:integrationId", async (req: Request, res: Response) => {
    // TODO: Implement actual disconnect logic
    return res.status(501).json({ message: "Not implemented" });
});

export default router;
