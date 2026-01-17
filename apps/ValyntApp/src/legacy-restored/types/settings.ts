/**
 * Settings Type Definitions
 * 
 * Sprint 2 Enhancement: Type-safe setting keys
 * Prevents typos and provides IntelliSense for all setting keys
 * 
 * DX Enhancement: Strict discriminated unions
 * - Compile-time validation of setting keys
 * - Type-safe value access with proper inference
 * - Prevents runtime errors from typos
 */

// ============================================================================
// User-Level Setting Keys
// ============================================================================

export type UserTheme = 'light' | 'dark' | 'system';
export type UserLanguage = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';
export type UserDateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY';
export type UserTimeFormat = '12h' | '24h';
export type UserFontSize = 'small' | 'medium' | 'large' | 'extra-large';

export type UserSettingKey =
  // Appearance
  | 'user.theme'
  | 'user.language'
  | 'user.timezone'
  | 'user.dateFormat'
  | 'user.timeFormat'
  // Notifications
  | 'user.notifications.email'
  | 'user.notifications.push'
  | 'user.notifications.slack'
  | 'user.notifications.inApp'
  // Accessibility
  | 'user.accessibility.highContrast'
  | 'user.accessibility.fontSize'
  | 'user.accessibility.reducedMotion';

// ============================================================================
// Team-Level Setting Keys
// ============================================================================

export type TeamRole = 'admin' | 'member' | 'guest';
export type TeamPriority = 'low' | 'medium' | 'high';

export type TeamSettingKey =
  // Access Control
  | 'team.defaultRole'
  | 'team.allowGuestAccess'
  | 'team.requireApproval'
  // Notifications
  | 'team.notifications.mentions'
  | 'team.notifications.updates'
  // Workflow
  | 'team.workflow.autoAssign'
  | 'team.workflow.defaultPriority';

// ============================================================================
// Organization-Level Setting Keys
// ============================================================================

export type OrganizationCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';

export type OrganizationSettingKey =
  // General
  | 'organization.currency'
  | 'organization.fiscalYearStart'
  | 'organization.workingDays'
  | 'organization.workingHours.start'
  | 'organization.workingHours.end'
  // Security
  | 'organization.security.mfaRequired'
  | 'organization.security.ssoRequired'
  | 'organization.security.sessionTimeout'
  | 'organization.security.passwordPolicy.minLength'
  | 'organization.security.passwordPolicy.requireUppercase'
  | 'organization.security.passwordPolicy.requireLowercase'
  | 'organization.security.passwordPolicy.requireNumbers'
  | 'organization.security.passwordPolicy.requireSymbols'
  // Billing
  | 'organization.billing.autoRenew'
  | 'organization.billing.invoiceEmail';

// ============================================================================
// Combined Setting Key Type
// ============================================================================

export type SettingKey = UserSettingKey | TeamSettingKey | OrganizationSettingKey;

// ============================================================================
// Setting Value Types (Type-safe values for each key)
// ============================================================================

export type SettingValueMap = {
  // User - Appearance
  'user.theme': UserTheme;
  'user.language': UserLanguage;
  'user.timezone': string; // IANA timezone
  'user.dateFormat': UserDateFormat;
  'user.timeFormat': UserTimeFormat;
  
  // User - Notifications
  'user.notifications.email': boolean;
  'user.notifications.push': boolean;
  'user.notifications.slack': boolean;
  'user.notifications.inApp': boolean;
  
  // User - Accessibility
  'user.accessibility.highContrast': boolean;
  'user.accessibility.fontSize': UserFontSize;
  'user.accessibility.reducedMotion': boolean;
  
  // Team - Access Control
  'team.defaultRole': TeamRole;
  'team.allowGuestAccess': boolean;
  'team.requireApproval': boolean;
  
  // Team - Notifications
  'team.notifications.mentions': boolean;
  'team.notifications.updates': boolean;
  
  // Team - Workflow
  'team.workflow.autoAssign': boolean;
  'team.workflow.defaultPriority': TeamPriority;
  
  // Organization - General
  'organization.currency': OrganizationCurrency;
  'organization.fiscalYearStart': string; // MM-DD format
  'organization.workingDays': string[]; // ['mon', 'tue', ...]
  'organization.workingHours.start': string; // HH:MM format
  'organization.workingHours.end': string; // HH:MM format
  
  // Organization - Security
  'organization.security.mfaRequired': boolean;
  'organization.security.ssoRequired': boolean;
  'organization.security.sessionTimeout': number; // minutes
  'organization.security.passwordPolicy.minLength': number;
  'organization.security.passwordPolicy.requireUppercase': boolean;
  'organization.security.passwordPolicy.requireLowercase': boolean;
  'organization.security.passwordPolicy.requireNumbers': boolean;
  'organization.security.passwordPolicy.requireSymbols': boolean;
  
  // Organization - Billing
  'organization.billing.autoRenew': boolean;
  'organization.billing.invoiceEmail': string;
};

// ============================================================================
// Type-safe Setting Access
// ============================================================================

/**
 * Get the value type for a specific setting key
 * 
 * @example
 * type ThemeValue = SettingValue<'user.theme'>; // 'light' | 'dark' | 'system'
 */
export type SettingValue<K extends SettingKey> = SettingValueMap[K];

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a key is a valid user setting key
 */
export function isUserSettingKey(key: string): key is UserSettingKey {
  return key.startsWith('user.');
}

/**
 * Check if a key is a valid team setting key
 */
export function isTeamSettingKey(key: string): key is TeamSettingKey {
  return key.startsWith('team.');
}

/**
 * Check if a key is a valid organization setting key
 */
export function isOrganizationSettingKey(key: string): key is OrganizationSettingKey {
  return key.startsWith('organization.');
}

/**
 * Check if a key is a valid setting key
 */
export function isValidSettingKey(key: string): key is SettingKey {
  return isUserSettingKey(key) || isTeamSettingKey(key) || isOrganizationSettingKey(key);
}

// ============================================================================
// Setting Metadata
// ============================================================================

export interface SettingMetadata {
  key: SettingKey;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'array' | 'select';
  defaultValue: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    options?: readonly string[];
  };
}

/**
 * Setting metadata registry for validation and UI generation
 */
export const SETTING_METADATA: Record<SettingKey, SettingMetadata> = {
  // User - Appearance
  'user.theme': {
    key: 'user.theme',
    label: 'Theme',
    description: 'Choose your preferred color theme',
    type: 'select',
    defaultValue: 'system',
    validation: { options: ['light', 'dark', 'system'] },
  },
  'user.language': {
    key: 'user.language',
    label: 'Language',
    description: 'Select your preferred language',
    type: 'select',
    defaultValue: 'en',
    validation: { options: ['en', 'es', 'fr', 'de', 'ja', 'zh'] },
  },
  'user.timezone': {
    key: 'user.timezone',
    label: 'Timezone',
    description: 'Your local timezone',
    type: 'string',
    defaultValue: 'UTC',
  },
  'user.dateFormat': {
    key: 'user.dateFormat',
    label: 'Date Format',
    description: 'How dates are displayed',
    type: 'select',
    defaultValue: 'MM/DD/YYYY',
    validation: { options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMM DD, YYYY'] },
  },
  'user.timeFormat': {
    key: 'user.timeFormat',
    label: 'Time Format',
    description: '12-hour or 24-hour time',
    type: 'select',
    defaultValue: '12h',
    validation: { options: ['12h', '24h'] },
  },
  
  // User - Notifications
  'user.notifications.email': {
    key: 'user.notifications.email',
    label: 'Email Notifications',
    description: 'Receive notifications via email',
    type: 'boolean',
    defaultValue: true,
  },
  'user.notifications.push': {
    key: 'user.notifications.push',
    label: 'Push Notifications',
    description: 'Receive browser push notifications',
    type: 'boolean',
    defaultValue: true,
  },
  'user.notifications.slack': {
    key: 'user.notifications.slack',
    label: 'Slack Notifications',
    description: 'Receive notifications in Slack',
    type: 'boolean',
    defaultValue: false,
  },
  'user.notifications.inApp': {
    key: 'user.notifications.inApp',
    label: 'In-App Notifications',
    description: 'Show notifications within the app',
    type: 'boolean',
    defaultValue: true,
  },
  
  // User - Accessibility
  'user.accessibility.highContrast': {
    key: 'user.accessibility.highContrast',
    label: 'High Contrast',
    description: 'Increase contrast for better visibility',
    type: 'boolean',
    defaultValue: false,
  },
  'user.accessibility.fontSize': {
    key: 'user.accessibility.fontSize',
    label: 'Font Size',
    description: 'Adjust text size',
    type: 'select',
    defaultValue: 'medium',
    validation: { options: ['small', 'medium', 'large', 'extra-large'] },
  },
  'user.accessibility.reducedMotion': {
    key: 'user.accessibility.reducedMotion',
    label: 'Reduced Motion',
    description: 'Minimize animations',
    type: 'boolean',
    defaultValue: false,
  },
  
  // Team - Access Control
  'team.defaultRole': {
    key: 'team.defaultRole',
    label: 'Default Role',
    description: 'Default role for new team members',
    type: 'select',
    defaultValue: 'member',
    validation: { options: ['admin', 'member', 'guest'] },
  },
  'team.allowGuestAccess': {
    key: 'team.allowGuestAccess',
    label: 'Allow Guest Access',
    description: 'Enable guest user access',
    type: 'boolean',
    defaultValue: false,
  },
  'team.requireApproval': {
    key: 'team.requireApproval',
    label: 'Require Approval',
    description: 'Require approval for certain actions',
    type: 'boolean',
    defaultValue: true,
  },
  
  // Team - Notifications
  'team.notifications.mentions': {
    key: 'team.notifications.mentions',
    label: 'Mention Notifications',
    description: 'Notify when mentioned',
    type: 'boolean',
    defaultValue: true,
  },
  'team.notifications.updates': {
    key: 'team.notifications.updates',
    label: 'Update Notifications',
    description: 'Notify on project updates',
    type: 'boolean',
    defaultValue: true,
  },
  
  // Team - Workflow
  'team.workflow.autoAssign': {
    key: 'team.workflow.autoAssign',
    label: 'Auto-Assign Tasks',
    description: 'Automatically assign tasks',
    type: 'boolean',
    defaultValue: false,
  },
  'team.workflow.defaultPriority': {
    key: 'team.workflow.defaultPriority',
    label: 'Default Priority',
    description: 'Default task priority',
    type: 'select',
    defaultValue: 'medium',
    validation: { options: ['low', 'medium', 'high'] },
  },
  
  // Organization - General
  'organization.currency': {
    key: 'organization.currency',
    label: 'Currency',
    description: 'Default currency',
    type: 'select',
    defaultValue: 'USD',
    validation: { options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] },
  },
  'organization.fiscalYearStart': {
    key: 'organization.fiscalYearStart',
    label: 'Fiscal Year Start',
    description: 'Start of fiscal year (MM-DD)',
    type: 'string',
    defaultValue: '01-01',
    validation: { pattern: /^\d{2}-\d{2}$/ },
  },
  'organization.workingDays': {
    key: 'organization.workingDays',
    label: 'Working Days',
    description: 'Days of the week for work',
    type: 'array',
    defaultValue: ['mon', 'tue', 'wed', 'thu', 'fri'],
  },
  'organization.workingHours.start': {
    key: 'organization.workingHours.start',
    label: 'Work Start Time',
    description: 'Start of work day (HH:MM)',
    type: 'string',
    defaultValue: '09:00',
    validation: { pattern: /^\d{2}:\d{2}$/ },
  },
  'organization.workingHours.end': {
    key: 'organization.workingHours.end',
    label: 'Work End Time',
    description: 'End of work day (HH:MM)',
    type: 'string',
    defaultValue: '17:00',
    validation: { pattern: /^\d{2}:\d{2}$/ },
  },
  
  // Organization - Security
  'organization.security.mfaRequired': {
    key: 'organization.security.mfaRequired',
    label: 'Require MFA',
    description: 'Require multi-factor authentication',
    type: 'boolean',
    defaultValue: false,
  },
  'organization.security.ssoRequired': {
    key: 'organization.security.ssoRequired',
    label: 'Require SSO',
    description: 'Require single sign-on',
    type: 'boolean',
    defaultValue: false,
  },
  'organization.security.sessionTimeout': {
    key: 'organization.security.sessionTimeout',
    label: 'Session Timeout',
    description: 'Session timeout in minutes',
    type: 'number',
    defaultValue: 60,
    validation: { min: 5, max: 1440 },
  },
  'organization.security.passwordPolicy.minLength': {
    key: 'organization.security.passwordPolicy.minLength',
    label: 'Minimum Password Length',
    description: 'Minimum characters required',
    type: 'number',
    defaultValue: 12,
    validation: { min: 8, max: 128 },
  },
  'organization.security.passwordPolicy.requireUppercase': {
    key: 'organization.security.passwordPolicy.requireUppercase',
    label: 'Require Uppercase',
    description: 'Require uppercase letters',
    type: 'boolean',
    defaultValue: true,
  },
  'organization.security.passwordPolicy.requireLowercase': {
    key: 'organization.security.passwordPolicy.requireLowercase',
    label: 'Require Lowercase',
    description: 'Require lowercase letters',
    type: 'boolean',
    defaultValue: true,
  },
  'organization.security.passwordPolicy.requireNumbers': {
    key: 'organization.security.passwordPolicy.requireNumbers',
    label: 'Require Numbers',
    description: 'Require numeric characters',
    type: 'boolean',
    defaultValue: true,
  },
  'organization.security.passwordPolicy.requireSymbols': {
    key: 'organization.security.passwordPolicy.requireSymbols',
    label: 'Require Symbols',
    description: 'Require special characters',
    type: 'boolean',
    defaultValue: false,
  },
  
  // Organization - Billing
  'organization.billing.autoRenew': {
    key: 'organization.billing.autoRenew',
    label: 'Auto-Renew',
    description: 'Automatically renew subscription',
    type: 'boolean',
    defaultValue: true,
  },
  'organization.billing.invoiceEmail': {
    key: 'organization.billing.invoiceEmail',
    label: 'Invoice Email',
    description: 'Email for invoices',
    type: 'string',
    defaultValue: '',
    validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  },
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value matches the expected type for a setting key
 */
export function isValidSettingValue<K extends SettingKey>(
  key: K,
  value: unknown
): value is SettingValue<K> {
  const metadata = SETTING_METADATA[key];
  
  switch (metadata.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      if (typeof value !== 'string') return false;
      if (metadata.validation?.pattern) {
        return metadata.validation.pattern.test(value);
      }
      return true;
    case 'number':
      if (typeof value !== 'number') return false;
      if (metadata.validation?.min !== undefined && value < metadata.validation.min) {
        return false;
      }
      if (metadata.validation?.max !== undefined && value > metadata.validation.max) {
        return false;
      }
      return true;
    case 'array':
      return Array.isArray(value);
    case 'select':
      if (typeof value !== 'string') return false;
      if (metadata.validation?.options) {
        return metadata.validation.options.includes(value);
      }
      return true;
    default:
      return false;
  }
}

// ============================================================================
// Type-Safe Settings Accessor
// ============================================================================

/**
 * Type-safe settings accessor that prevents typos at compile time
 * 
 * Usage:
 *   const value = getSettingValue(settings, 'user.profile.displayName');
 *   // TypeScript knows value is a string
 * 
 * Benefits:
 *   - Compile-time validation of setting keys
 *   - Proper type inference for values
 *   - IntelliSense support
 *   - Prevents runtime errors from typos
 */
export function getSettingValue<K extends SettingKey>(
  settings: Record<string, unknown>,
  key: K
): SettingValue<K> | undefined {
  const value = settings[key];
  
  if (value === undefined) {
    return SETTING_METADATA[key].defaultValue as SettingValue<K>;
  }
  
  if (isValidSettingValue(key, value)) {
    return value;
  }
  
  return SETTING_METADATA[key].defaultValue as SettingValue<K>;
}

/**
 * Type-safe settings setter that validates values at compile time
 * 
 * Usage:
 *   const newSettings = setSettingValue(settings, 'user.profile.displayName', 'John');
 *   // TypeScript ensures 'John' is a valid string
 */
export function setSettingValue<K extends SettingKey>(
  settings: Record<string, unknown>,
  key: K,
  value: SettingValue<K>
): Record<string, unknown> {
  if (!isValidSettingValue(key, value)) {
    console.warn(`Invalid value for setting ${key}:`, value);
    return settings;
  }
  
  return {
    ...settings,
    [key]: value,
  };
}

/**
 * Discriminated union type for type-safe setting access
 * 
 * This allows pattern matching on setting keys with proper type inference:
 * 
 * Example:
 *   function handleSetting(setting: SettingEntry) {
 *     switch (setting.key) {
 *       case 'user.profile.displayName':
 *         // TypeScript knows setting.value is string
 *         console.log(setting.value.toUpperCase());
 *         break;
 *       case 'user.notifications.emailEnabled':
 *         // TypeScript knows setting.value is boolean
 *         if (setting.value) { ... }
 *         break;
 *     }
 *   }
 */
export type SettingEntry = {
  [K in SettingKey]: {
    key: K;
    value: SettingValue<K>;
    metadata: typeof SETTING_METADATA[K];
  };
}[SettingKey];

/**
 * Create a type-safe setting entry
 */
export function createSettingEntry<K extends SettingKey>(
  key: K,
  value: SettingValue<K>
): SettingEntry {
  return {
    key,
    value,
    metadata: SETTING_METADATA[key],
  } as SettingEntry;
}
