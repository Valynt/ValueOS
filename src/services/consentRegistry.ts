import { settings } from '../config/settings';
import { createServerSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { ConsentRegistry } from '../types/consent';

const CONSENT_TABLE = 'user_consents';

export function isConsentRegistryConfigured(): boolean {
  return Boolean(settings.VITE_SUPABASE_URL && settings.SUPABASE_SERVICE_KEY);
}

function createDatabaseConsentRegistry(): ConsentRegistry {
  const serviceKey = settings.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required to load the consent registry.');
  }

  const supabase = createServerSupabaseClient(serviceKey);

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
