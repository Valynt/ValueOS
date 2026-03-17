
import { logger } from '../../lib/logger.js'
import { createServerSupabaseClient } from '../../lib/supabase.js'

export interface IntegrationState {
  enabled: boolean;
  disabledAt?: string;
  disabledBy?: string;
  reason?: string;
}

interface IntegrationSettings {
  enabled?: boolean;
  disabledAt?: string;
  disabledBy?: string;
  reason?: string;
}

type OrganizationSettings = Record<string, unknown> & {
  integrations?: IntegrationSettings;
};

function isOrganizationSettings(settings: unknown): settings is OrganizationSettings {
  if (settings === null || typeof settings !== 'object') {
    return false;
  }

  // If there is an `integrations` property, it should be an object as well.
  const maybeSettings = settings as { integrations?: unknown };
  if (
    'integrations' in maybeSettings &&
    maybeSettings.integrations !== undefined &&
    (maybeSettings.integrations === null || typeof maybeSettings.integrations !== 'object')
  ) {
    return false;
  }

  return true;
}

/**
 * Service to manage integration access state per tenant
 */
export class IntegrationControlService {

  /**
   * Check if integrations are enabled for a tenant
   */
  async areIntegrationsEnabled(tenantId: string): Promise<boolean> {
    try {
      // Check organizations.settings first (primary source of truth for disablement)
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', tenantId)
        .single();

      if (error || !data) return true; // Default to enabled if we can't check

      const settings: unknown = data.settings;
      if (isOrganizationSettings(settings) && settings.integrations?.enabled === false) {
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Failed to check integration status', error as Error, { tenantId });
      return true; // Fail open to avoid blocking legitimate traffic on error, assuming RBAC handles auth
    }
  }

  /**
   * Disable all integrations for a tenant
   */
  async disableIntegrations(tenantId: string, reason: string = 'Tenant deprovisioned'): Promise<void> {
    const supabase = createServerSupabaseClient();

    // Fetch current settings
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch organization settings: ${fetchError.message}`);
    }

    const currentSettings: OrganizationSettings = isOrganizationSettings(org?.settings)
      ? org.settings
      : {};
    const newSettings: OrganizationSettings = {
      ...currentSettings,
      integrations: {
        ...(currentSettings.integrations || {}),
        enabled: false,
        disabledAt: new Date().toISOString(),
        disabledBy: 'system',
        reason
      }
    };

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', tenantId);

    if (updateError) {
      throw new Error(`Failed to update organization settings: ${updateError.message}`);
    }

    logger.info(`Integrations disabled for tenant ${tenantId}`);
  }

  /**
   * Scrub credentials from likely storage locations
   */
  async scrubCredentials(tenantId: string): Promise<number> {
    let scrubbedCount = 0;
    const supabase = createServerSupabaseClient();

    // 1. Scrub organizations.settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (org?.settings && typeof org.settings === 'object') {
      const settings = org.settings as Record<string, unknown>;
      let modified = false;

      const redactKeys = (obj: unknown): unknown => {
        const isRecord = (value: unknown): value is Record<string, unknown> => {
          return typeof value === 'object' && value !== null && !Array.isArray(value);
        };

        if (Array.isArray(obj)) {
          return obj.map(item => redactKeys(item));
        }

        if (!isRecord(obj)) {
          return obj;
        }

        const workingObj: Record<string, unknown> = { ...obj };

        for (const key of Object.keys(workingObj)) {
          const lowerKey = key.toLowerCase();
          const value = workingObj[key];

          if (['access_token', 'refresh_token', 'api_key', 'secret', 'password', 'credential', 'oauth_token'].some(k => lowerKey.includes(k))) {
            if (typeof value === 'string' && value !== 'REVOKED') {
              workingObj[key] = 'REVOKED';
              modified = true;
              scrubbedCount++;
            }
          } else if (typeof value === 'object' && value !== null) {
            workingObj[key] = redactKeys(value);
          }
        }

        return workingObj;
      };

      const newSettings = redactKeys(settings);

      if (modified) {
        const { error: updateError } = await supabase
          .from('organizations')
          .update({ settings: newSettings })
          .eq('id', tenantId);

        if (updateError) {
          logger.error('Failed to update organization settings during credential scrub', {
            tenantId,
            error: updateError.message,
          });
          throw new Error(`Failed to update organization settings during credential scrub: ${updateError.message}`);
        }
      }
    }

    // 2. Scrub settings table (tenant scoped)
    // We fetch all organization scoped settings for this tenant
    const { data: tenantSettings } = await supabase
      .from('settings')
      .select('id, key, value, type')
      .eq('scope', 'organization')
      .eq('scope_id', tenantId);

    if (tenantSettings) {
        for (const setting of tenantSettings) {
            let value = setting.value;
            let modified = false;

            // Check key name
             const lowerKey = setting.key.toLowerCase();
             if (['access_token', 'refresh_token', 'api_key', 'secret', 'password', 'credential', 'oauth_token'].some(k => lowerKey.includes(k))) {
                 // It's a credential setting
                 // Since value is stored as string/json in DB based on type, we need to handle it.
                 // The settingsService handles serialization. For now we just check if it looks like a sensitive key.
                 // We will update it to "REVOKED" (serialized).

                 // If it's an object type, we might want to drill down, but if the key itself is "hubspot_api_key", we just nuke the value.

                 await supabase
                    .from('settings')
                    .update({
                        value: '"REVOKED"', // simplistic serialization for string
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', setting.id);
                 scrubbedCount++;
                 continue;
             }

             // If value is a JSON object, search inside
             if (setting.type === 'object' || setting.type === 'array') {
                try {
                    let parsed = JSON.parse(value);

                    const redactKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
                        if (!obj || typeof obj !== 'object') return obj;
                        for (const k in obj) {
                             const lowerK = k.toLowerCase();
                             if (['access_token', 'refresh_token', 'api_key', 'secret', 'password', 'credential', 'oauth_token'].some(match => lowerK.includes(match))) {
                                if (obj[k] !== 'REVOKED') {
                                    obj[k] = 'REVOKED';
                                    modified = true;
                                    scrubbedCount++;
                                }
                             } else if (typeof obj[k] === 'object') {
                                 redactKeys(obj[k]);
                             }
                        }
                        return obj;
                    };

                    redactKeys(parsed);

                    if (modified) {
                        await supabase
                           .from('settings')
                           .update({
                               value: JSON.stringify(parsed),
                               updated_at: new Date().toISOString()
                           })
                           .eq('id', setting.id);
                    }
                } catch (e) {
                    // ignore parse errors
                }
             }
        }
    }

    return scrubbedCount;
  }
}

export const integrationControlService = new IntegrationControlService();
