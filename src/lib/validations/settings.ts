/**
 * Centralized Zod Schemas for Settings Validation
 * 
 * Enterprise-grade runtime type safety for settings stored in JSONB columns.
 * TypeScript alone cannot guarantee database data matches expected format.
 * Zod validates payloads at API boundaries and inside the application.
 * 
 * Strategy:
 * - Centralized schemas for each tier (User, Team, Organization)
 * - Strict transformation with .parse() for fetching
 * - Partial schemas with .partial() for updates
 * - Inferred types to keep UI and validation in sync
 */

import { z } from 'zod';

// ============================================================================
// User Settings Schemas
// ============================================================================

/**
 * User Profile Settings
 */
export const UserProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().default('UTC'),
  language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh']).default('en'),
});

/**
 * User Notification Settings
 */
export const UserNotificationsSchema = z.object({
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  mentions: z.boolean().default(true),
  taskAssignments: z.boolean().default(true),
  weeklyDigest: z.boolean().default(true),
  projectUpdates: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
});

/**
 * User Appearance Settings
 */
export const UserAppearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  compactMode: z.boolean().default(false),
  sidebarCollapsed: z.boolean().default(false),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
  colorScheme: z.enum(['default', 'blue', 'green', 'purple']).default('default'),
});

/**
 * Complete User Settings
 */
export const UserSettingsSchema = z.object({
  profile: UserProfileSchema,
  notifications: UserNotificationsSchema,
  appearance: UserAppearanceSchema,
});

// Inferred TypeScript types
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserNotifications = z.infer<typeof UserNotificationsSchema>;
export type UserAppearance = z.infer<typeof UserAppearanceSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// Partial schemas for updates
export const UserProfileUpdateSchema = UserProfileSchema.partial();
export const UserNotificationsUpdateSchema = UserNotificationsSchema.partial();
export const UserAppearanceUpdateSchema = UserAppearanceSchema.partial();

// ============================================================================
// Team Settings Schemas
// ============================================================================

/**
 * Team Workflow Settings
 */
export const TeamWorkflowSchema = z.object({
  defaultTaskStatus: z.enum(['todo', 'in-progress', 'review', 'done']).default('todo'),
  requireApproval: z.boolean().default(false),
  autoArchive: z.boolean().default(true),
  archiveDays: z.number().int().min(30).max(365).default(90),
  defaultAssignee: z.string().default('unassigned'),
});

/**
 * Team Notification Settings
 */
export const TeamNotificationsSchema = z.object({
  slackEnabled: z.boolean().default(false),
  slackWebhook: z.string().url().optional(),
  emailDigestEnabled: z.boolean().default(true),
  digestFrequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
});

/**
 * Complete Team Settings
 */
export const TeamSettingsSchema = z.object({
  workflow: TeamWorkflowSchema,
  notifications: TeamNotificationsSchema,
});

// Inferred types
export type TeamWorkflow = z.infer<typeof TeamWorkflowSchema>;
export type TeamNotifications = z.infer<typeof TeamNotificationsSchema>;
export type TeamSettings = z.infer<typeof TeamSettingsSchema>;

// Partial schemas for updates
export const TeamWorkflowUpdateSchema = TeamWorkflowSchema.partial();
export const TeamNotificationsUpdateSchema = TeamNotificationsSchema.partial();

// ============================================================================
// Organization Settings Schemas
// ============================================================================

/**
 * Organization Security - Password Policy
 */
export const PasswordPolicySchema = z.object({
  minLength: z.number().int().min(8).max(32).default(12),
  requireUppercase: z.boolean().default(true),
  requireNumbers: z.boolean().default(true),
  requireSymbols: z.boolean().default(true),
  expiryDays: z.number().int().min(0).max(365).default(90),
});

/**
 * Organization Security - Session Management
 */
export const SessionManagementSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(15).max(1440).default(60),
  idleTimeoutMinutes: z.number().int().min(5).max(120).default(30),
  maxConcurrentSessions: z.number().int().min(1).max(10).default(3),
});

/**
 * Organization Security Settings
 */
export const OrgSecuritySchema = z.object({
  enforceMFA: z.boolean().default(false),
  enforceSSO: z.boolean().default(false),
  passwordPolicy: PasswordPolicySchema,
  sessionManagement: SessionManagementSchema,
  ipWhitelistEnabled: z.boolean().default(false),
  ipWhitelist: z.array(z.string().ip()).default([]),
  webAuthnEnabled: z.boolean().default(false),
});

/**
 * Organization Branding Settings
 */
export const OrgBrandingSchema = z.object({
  companyName: z.string().min(1).max(100),
  logo: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#18C3A5'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customDomain: z.string().url().optional(),
});

/**
 * Organization Billing Settings
 */
export const OrgBillingSchema = z.object({
  autoRenew: z.boolean().default(true),
  invoiceEmail: z.string().email(),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  paymentMethod: z.enum(['card', 'invoice', 'wire']).default('card'),
});

/**
 * Complete Organization Settings
 */
export const OrganizationSettingsSchema = z.object({
  security: OrgSecuritySchema,
  branding: OrgBrandingSchema,
  billing: OrgBillingSchema,
});

// Inferred types
export type PasswordPolicy = z.infer<typeof PasswordPolicySchema>;
export type SessionManagement = z.infer<typeof SessionManagementSchema>;
export type OrgSecurity = z.infer<typeof OrgSecuritySchema>;
export type OrgBranding = z.infer<typeof OrgBrandingSchema>;
export type OrgBilling = z.infer<typeof OrgBillingSchema>;
export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;

// Partial schemas for updates
export const OrgSecurityUpdateSchema = OrgSecuritySchema.partial().extend({
  passwordPolicy: PasswordPolicySchema.partial().optional(),
  sessionManagement: SessionManagementSchema.partial().optional(),
});
export const OrgBrandingUpdateSchema = OrgBrandingSchema.partial();
export const OrgBillingUpdateSchema = OrgBillingSchema.partial();

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safe parse with detailed error reporting
 */
export function validateSettings<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.');
    return `${context}.${path}: ${err.message}`;
  });
  
  return { success: false, errors };
}

/**
 * Parse settings with fallback to defaults
 */
export function parseSettingsWithDefaults<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    console.warn('Settings validation failed, using defaults:', error);
    // Return schema defaults by parsing empty object
    return schema.parse({});
  }
}

/**
 * Validate partial update
 */
export function validatePartialUpdate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: Partial<T> } | { success: false; errors: string[] } {
  const partialSchema = schema.partial();
  const result = partialSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
  
  return { success: false, errors };
}

// ============================================================================
// Settings Templates (for rapid tenant onboarding)
// ============================================================================

/**
 * Settings Template Type
 */
export const SettingsTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['standard', 'strict', 'creative']),
  settings: OrganizationSettingsSchema,
});

export type SettingsTemplate = z.infer<typeof SettingsTemplateSchema>;

/**
 * Predefined Settings Templates
 */
export const SETTINGS_TEMPLATES: Record<string, SettingsTemplate> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced MFA, 60-min sessions, standard branding. General SaaS / Default.',
    category: 'standard',
    settings: {
      security: {
        enforceMFA: false,
        enforceSSO: false,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
          expiryDays: 90,
        },
        sessionManagement: {
          sessionTimeoutMinutes: 60,
          idleTimeoutMinutes: 30,
          maxConcurrentSessions: 3,
        },
        ipWhitelistEnabled: false,
        ipWhitelist: [],
        webAuthnEnabled: false,
      },
      branding: {
        companyName: 'My Company',
        primaryColor: '#18C3A5',
      },
      billing: {
        autoRenew: true,
        invoiceEmail: 'billing@example.com',
        billingCycle: 'monthly',
        paymentMethod: 'card',
      },
    },
  },
  
  strict: {
    id: 'strict',
    name: 'Strict',
    description: 'Enforced MFA & WebAuthn, 15-min idle timeout, IP Whitelisting. FinTech, HealthTech, Compliance.',
    category: 'strict',
    settings: {
      security: {
        enforceMFA: true,
        enforceSSO: true,
        passwordPolicy: {
          minLength: 16,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: true,
          expiryDays: 60,
        },
        sessionManagement: {
          sessionTimeoutMinutes: 30,
          idleTimeoutMinutes: 15,
          maxConcurrentSessions: 1,
        },
        ipWhitelistEnabled: true,
        ipWhitelist: [],
        webAuthnEnabled: true,
      },
      branding: {
        companyName: 'My Company',
        primaryColor: '#18C3A5',
      },
      billing: {
        autoRenew: true,
        invoiceEmail: 'billing@example.com',
        billingCycle: 'annual',
        paymentMethod: 'invoice',
      },
    },
  },
  
  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'Lenient session limits, dark mode default, "Beta" AI features. Agencies, Startups, Design teams.',
    category: 'creative',
    settings: {
      security: {
        enforceMFA: false,
        enforceSSO: false,
        passwordPolicy: {
          minLength: 10,
          requireUppercase: false,
          requireNumbers: true,
          requireSymbols: false,
          expiryDays: 0, // Never expires
        },
        sessionManagement: {
          sessionTimeoutMinutes: 120,
          idleTimeoutMinutes: 60,
          maxConcurrentSessions: 5,
        },
        ipWhitelistEnabled: false,
        ipWhitelist: [],
        webAuthnEnabled: false,
      },
      branding: {
        companyName: 'My Company',
        primaryColor: '#18C3A5',
      },
      billing: {
        autoRenew: true,
        invoiceEmail: 'billing@example.com',
        billingCycle: 'monthly',
        paymentMethod: 'card',
      },
    },
  },
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): SettingsTemplate | null {
  return SETTINGS_TEMPLATES[templateId] || null;
}

/**
 * List all available templates
 */
export function listTemplates(): SettingsTemplate[] {
  return Object.values(SETTINGS_TEMPLATES);
}
