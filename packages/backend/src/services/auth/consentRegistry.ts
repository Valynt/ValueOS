import { logger } from "../../lib/logger.js";
import type { ConsentRegistry, ConsentQuery, ConsentQueryClient } from "../../types/consent";
import { settings } from "../config/settings.js";

const CONSENT_TABLE = "user_consents";
const CANONICAL_SUBJECT_COLUMN = "auth_subject";
const TENANT_COLUMN = "tenant_id";

export function isConsentRegistryConfigured(): boolean {
  return Boolean(settings.VITE_SUPABASE_URL);
}

export function createConsentRegistry(
  supabaseFactory: (query: ConsentQuery) => ConsentQueryClient = (query) => query.supabase
): ConsentRegistry {
  return {
    hasConsent: async ({ tenantId, scope, subject, supabase }) => {
      const client = supabaseFactory({ tenantId, scope, subject, supabase });
      const { data, error } = await client
        .from(CONSENT_TABLE)
        .select("id")
        .eq(TENANT_COLUMN, tenantId)
        .eq(CANONICAL_SUBJECT_COLUMN, subject)
        .eq("consent_type", scope)
        .is("withdrawn_at", null)
        .limit(1);

      if (error) {
        logger.error("Failed to check consent registry", error, {
          tenantId,
          scope,
          subject,
        });
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    },
  };
}

export const consentRegistry: ConsentRegistry | null = isConsentRegistryConfigured()
  ? createConsentRegistry()
  : null;
