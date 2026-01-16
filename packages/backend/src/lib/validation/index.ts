/**
 * Validation Layer
 *
 * Centralized validation utilities for the backend API.
 */

// Sanitization utilities
export {
  sanitizeForLog,
  sanitizeObjectForLog,
  escapeHtml,
  stripHtml,
  sanitizeHtml,
  escapeSqlString,
  escapeSqlLike,
  removeNullBytes,
  normalizeWhitespace,
  removeInvisibleChars,
  sanitizeString,
  detectPromptInjection,
  sanitizeForPrompt,
} from './sanitize';

// Safe regex utilities
export {
  analyzeRegexSafety,
  safeRegexExec,
  safeRegexTest,
  SafePatterns,
  isValidEmail,
  isValidUuid,
  isValidUrl,
  isValidPhoneE164,
  isValidIdentifier,
  isValidSlug,
  isValidIsoDate,
  isValidIsoDateTime,
  escapeRegex,
  createSearchPattern,
  MAX_SAFE_INPUT_LENGTH,
  MAX_REGEX_TIMEOUT_MS,
} from './safeRegex';

// Normalizers
export {
  normalizeEmail,
  extractEmailDomain,
  normalizePhone,
  formatPhoneForDisplay,
  normalizeUuid,
  normalizeSlug,
  normalizeUsername,
  normalizeName,
  normalizeCompanyName,
  normalizeCurrencyAmount,
  normalizePercentage,
  normalizeUrl,
  extractDomain,
} from './normalizers';

// Zod helpers
export {
  // Field limits
  FieldLimits,
  // String schemas
  sanitizedString,
  logSafeString,
  promptSafeString,
  // Common field schemas
  nameSchema,
  titleSchema,
  descriptionSchema,
  emailSchema,
  phoneSchema,
  optionalPhoneSchema,
  uuidSchema,
  optionalUuidSchema,
  urlSchema,
  optionalUrlSchema,
  slugSchema,
  usernameSchema,
  passwordSchema,
  tagsSchema,
  uuidArraySchema,
  // Numeric schemas
  positiveIntSchema,
  nonNegativeIntSchema,
  percentageSchema,
  currencySchema,
  pageSchema,
  limitSchema,
  // Date schemas
  isoDateSchema,
  isoDateTimeSchema,
  futureDateSchema,
  pastDateSchema,
  // Utilities
  safeRegexSchema,
  makePartial,
  strictSchema,
  withAuditFields,
  paginatedQuerySchema,
  safeParse,
  formatZodErrors,
  hasUnknownFields,
} from './zodHelpers';

// Example schemas
export {
  CreateUserSchema,
  UpdateUserSchema,
  CreateDealSchema,
  UpdateDealSchema,
  ListDealsQuerySchema,
  type CreateUserInput,
  type UpdateUserInput,
  type CreateDealInput,
  type UpdateDealInput,
  type ListDealsQuery,
} from './schemas';
