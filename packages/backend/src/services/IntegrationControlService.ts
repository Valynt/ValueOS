
import { logger } from '../lib/logger.js'
import { createServerSupabaseClient } from '../lib/supabase.js'
import { settingsService } from './SettingsService.js'

export interface IntegrationState {
  enabled: boolean;
  disabledAt?: string;
  disabledBy?: string;
  reason?: string;
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

      const settings = data.settings as Record<string, any>;
      if (settings?.integrations?.enabled === false) {
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

    const currentSettings = (org.settings || {}) as Record<string, any>;
    const newSettings = {
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

    if (org?.settings) {
      const settings = org.settings as Record<string, any>;
      let modified = false;

      // Recursive function to find and redact keys
      const redactKeys = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;

        for (const key in obj) {
            const lowerKey = key.toLowerCase();
            if (['access_token', 'refresh_token', 'api_key', 'secret', 'password', 'credential', 'oauth_token'].some(k => lowerKey.includes(k))) {
                if (obj[key] && obj[key] !== 'REVOKED') {
                    obj[key] = 'REVOKED';
                    modified = true;
                    scrubbedCount++;
                }
            } else if (typeof obj[key] === 'object') {
                redactKeys(obj[key]);
            }
        }
        return obj;
      };

      const newSettings = redactKeys({ ...settings }); // shallow copy top level

      if (modified) {
         await supabase.from('organizations').update({ settings: newSettings }).eq('id', tenantId);
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

                    const redactKeys = (obj: any): any => {
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
