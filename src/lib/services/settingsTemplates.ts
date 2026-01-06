/**
 * Settings Templates Service
 * 
 * Provides rapid tenant onboarding with pre-configured settings profiles.
 * Reduces "decision fatigue" for new Organization Admins.
 * 
 * Templates:
 * - Standard: Balanced MFA, 60-min sessions (General SaaS)
 * - Strict: Enforced MFA & WebAuthn, 15-min idle (FinTech, HealthTech)
 * - Creative: Lenient sessions, dark mode (Agencies, Startups)
 */

import { 
  SETTINGS_TEMPLATES, 
  getTemplate, 
  listTemplates,
  type SettingsTemplate,
  type OrganizationSettings,
  OrganizationSettingsSchema,
} from '../validations/settings';

// ============================================================================
// Template Application
// ============================================================================

/**
 * Apply a template to an organization
 * 
 * This function would typically be called during tenant provisioning:
 * 1. New organization created
 * 2. Admin selects template during onboarding
 * 3. applyTemplate() performs bulk insert into organization_configurations
 * 
 * @param orgId - Organization ID
 * @param templateId - Template ID ('standard', 'strict', 'creative')
 * @param overrides - Optional overrides to template settings
 * @returns Applied settings
 * 
 * @example
 * ```typescript
 * // During tenant provisioning
 * const settings = await applyTemplate('org-123', 'strict', {
 *   branding: {
 *     companyName: 'Acme Corp',
 *     logo: 'https://example.com/logo.png',
 *   },
 * });
 * ```
 */
export async function applyTemplate(
  orgId: string,
  templateId: string,
  overrides?: Partial<OrganizationSettings>
): Promise<OrganizationSettings> {
  const template = getTemplate(templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Merge template settings with overrides
  const settings: OrganizationSettings = {
    ...template.settings,
    ...overrides,
    // Deep merge nested objects
    security: {
      ...template.settings.security,
      ...overrides?.security,
      passwordPolicy: {
        ...template.settings.security.passwordPolicy,
        ...overrides?.security?.passwordPolicy,
      },
      sessionManagement: {
        ...template.settings.security.sessionManagement,
        ...overrides?.security?.sessionManagement,
      },
    },
    branding: {
      ...template.settings.branding,
      ...overrides?.branding,
    },
    billing: {
      ...template.settings.billing,
      ...overrides?.billing,
    },
  };
  
  // Validate merged settings
  const validated = OrganizationSettingsSchema.parse(settings);
  
  // In a real implementation, this would:
  // 1. Insert into organization_configurations table
  // 2. Set organization metadata (template_id, applied_at)
  // 3. Trigger any post-provisioning hooks
  
  // For now, we'll simulate the database operation
  await simulateDbInsert(orgId, validated, templateId);
  
  return validated;
}

/**
 * Simulate database insert (replace with actual Supabase call)
 */
async function simulateDbInsert(
  orgId: string,
  settings: OrganizationSettings,
  templateId: string
): Promise<void> {
  // In production, this would be:
  // await supabase
  //   .from('organization_configurations')
  //   .insert({
  //     organization_id: orgId,
  //     settings: settings,
  //     template_id: templateId,
  //     applied_at: new Date().toISOString(),
  //   });
  
  console.log(`Applied template ${templateId} to organization ${orgId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
}

// ============================================================================
// Template Comparison
// ============================================================================

/**
 * Compare templates to help users choose
 * 
 * @returns Comparison matrix of all templates
 */
export function compareTemplates(): {
  templateId: string;
  name: string;
  description: string;
  features: {
    mfaEnforced: boolean;
    ssoEnforced: boolean;
    sessionTimeout: number;
    idleTimeout: number;
    passwordMinLength: number;
    ipWhitelisting: boolean;
    webAuthn: boolean;
  };
}[] {
  return listTemplates().map(template => ({
    templateId: template.id,
    name: template.name,
    description: template.description,
    features: {
      mfaEnforced: template.settings.security.enforceMFA,
      ssoEnforced: template.settings.security.enforceSSO,
      sessionTimeout: template.settings.security.sessionManagement.sessionTimeoutMinutes,
      idleTimeout: template.settings.security.sessionManagement.idleTimeoutMinutes,
      passwordMinLength: template.settings.security.passwordPolicy.minLength,
      ipWhitelisting: template.settings.security.ipWhitelistEnabled,
      webAuthn: template.settings.security.webAuthnEnabled,
    },
  }));
}

// ============================================================================
// Template Recommendations
// ============================================================================

/**
 * Recommend a template based on organization characteristics
 * 
 * @param characteristics - Organization characteristics
 * @returns Recommended template ID
 */
export function recommendTemplate(characteristics: {
  industry?: string;
  size?: 'small' | 'medium' | 'large';
  complianceRequired?: boolean;
  securityLevel?: 'low' | 'medium' | 'high';
}): string {
  // High security or compliance required
  if (
    characteristics.complianceRequired ||
    characteristics.securityLevel === 'high' ||
    ['finance', 'healthcare', 'government'].includes(characteristics.industry || '')
  ) {
    return 'strict';
  }
  
  // Creative industries
  if (
    ['design', 'marketing', 'media', 'startup'].includes(characteristics.industry || '') ||
    characteristics.size === 'small'
  ) {
    return 'creative';
  }
  
  // Default to standard
  return 'standard';
}

// ============================================================================
// Template Migration
// ============================================================================

/**
 * Migrate organization from one template to another
 * 
 * @param orgId - Organization ID
 * @param fromTemplateId - Current template ID
 * @param toTemplateId - Target template ID
 * @param preserveCustomizations - Whether to preserve custom settings
 * @returns New settings
 */
export async function migrateTemplate(
  orgId: string,
  fromTemplateId: string,
  toTemplateId: string,
  preserveCustomizations: boolean = true
): Promise<OrganizationSettings> {
  const toTemplate = getTemplate(toTemplateId);
  
  if (!toTemplate) {
    throw new Error(`Template not found: ${toTemplateId}`);
  }
  
  // If preserving customizations, fetch current settings
  // and merge with new template
  if (preserveCustomizations) {
    // In production, fetch current settings from database
    // const currentSettings = await fetchOrgSettings(orgId);
    // return applyTemplate(orgId, toTemplateId, currentSettings);
  }
  
  // Otherwise, apply new template directly
  return applyTemplate(orgId, toTemplateId);
}

// ============================================================================
// Template Validation
// ============================================================================

/**
 * Validate that current settings match a template
 * 
 * @param settings - Current settings
 * @param templateId - Template ID to validate against
 * @returns Validation result with differences
 */
export function validateAgainstTemplate(
  settings: OrganizationSettings,
  templateId: string
): {
  matches: boolean;
  differences: string[];
} {
  const template = getTemplate(templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  const differences: string[] = [];
  
  // Compare security settings
  if (settings.security.enforceMFA !== template.settings.security.enforceMFA) {
    differences.push('security.enforceMFA');
  }
  if (settings.security.enforceSSO !== template.settings.security.enforceSSO) {
    differences.push('security.enforceSSO');
  }
  
  // Compare password policy
  const settingsPP = settings.security.passwordPolicy;
  const templatePP = template.settings.security.passwordPolicy;
  if (settingsPP.minLength !== templatePP.minLength) {
    differences.push('security.passwordPolicy.minLength');
  }
  
  // Compare session management
  const settingsSM = settings.security.sessionManagement;
  const templateSM = template.settings.security.sessionManagement;
  if (settingsSM.sessionTimeoutMinutes !== templateSM.sessionTimeoutMinutes) {
    differences.push('security.sessionManagement.sessionTimeoutMinutes');
  }
  
  return {
    matches: differences.length === 0,
    differences,
  };
}

// ============================================================================
// Export Template Registry
// ============================================================================

export { SETTINGS_TEMPLATES, getTemplate, listTemplates };
export type { SettingsTemplate };
