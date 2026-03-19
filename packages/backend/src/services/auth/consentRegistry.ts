import { logger } from "../../lib/logger.js";
import type { ConsentCheckRequest, ConsentRegistry } from "../../types/consent";
import { settings } from "../config/settings.js";

const CONSENT_TABLE = "user_consents";
const CONSENT_SUBJECT_COLUMN = "auth_subject";

export function isConsentRegistryConfigured(): boolean {
  return Boolean(settings.VITE_SUPABASE_URL);
}

export function createDatabaseConsentRegistry(): ConsentRegistry {
  return {
    hasConsent: async ({ tenantId, scope, subject, supabase }: ConsentCheckRequest) => {
      const { data, error } = await supabase
        .from(CONSENT_TABLE)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq(CONSENT_SUBJECT_COLUMN, subject)
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
  ? createDatabaseConsentRegistry()
  : null;
