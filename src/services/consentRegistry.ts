import { settings } from '../config/settings';
import { createSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { ConsentRegistry } from '../types/consent';

const CONSENT_TABLE = 'user_consents';

export function isConsentRegistryConfigured(): boolean {
  // Consent checks must use RLS-enforced clients (anon/user tokens), not service_role.
  // Rely on general Supabase configuration; createSupabaseClient() will handle auth context.
  return Boolean(settings.VITE_SUPABASE_URL);
}

function createDatabaseConsentRegistry(): ConsentRegistry {
  const supabase = createSupabaseClient();
  return {
    hasConsent: async (tenantId: string, scope: string) => {
      const { data, error } = await supabase
        .from(CONSENT_TABLE)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('consent_type', scope)
        .is('withdrawn_at', null)
        .limit(1);

      if (error) {
        logger.error('Failed to check consent registry', error, {
          tenantId,
          scope,
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
