/**
 * Example Validation Schemas
 *
 * Production-ready schemas for User and Deal entities.
 * Demonstrates all validation features:
 * - Unknown field rejection (.strict())
 * - Per-field max sizes
 * - String sanitization
 * - Email/phone/ID normalization
 * - Safe regex patterns
 */

import { z } from 'zod';

import { normalizeCompanyName, normalizeName } from './normalizers.js'
import {
  currencySchema,
  descriptionSchema,
  emailSchema,
  limitSchema,
  optionalPhoneSchema,
  optionalUrlSchema,
  optionalUuidSchema,
  pageSchema,
  passwordSchema,
  percentageSchema,
  sanitizedString,
  tagsSchema,
  uuidSchema,
} from './zodHelpers';

// ============================================================================
// User Schemas
// ============================================================================

/**
 * User role enum.
 */
export const UserRole = z.enum(['admin', 'member', 'viewer']);
export type UserRole = z.infer<typeof UserRole>;

/**
 * User status enum.
 */
export const UserStatus = z.enum(['active', 'inactive', 'pending', 'suspended']);
export type UserStatus = z.infer<typeof UserStatus>;

/**
 * Create User schema.
 * Used for user registration and admin user creation.
 */
export const CreateUserSchema = z
  .object({
    // Required fields
    email: emailSchema,
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name must be 50 characters or less')
      .transform((val) => normalizeName(val)),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name must be 50 characters or less')
      .transform((val) => normalizeName(val)),
    password: passwordSchema,

    // Optional fields
    phone: optionalPhoneSchema,
    title: z
      .string()
      .max(100, 'Title must be 100 characters or less')
      .transform((val) => val.trim())
      .optional(),
    department: z
      .string()
      .max(100, 'Department must be 100 characters or less')
      .transform((val) => val.trim())
      .optional(),
    avatarUrl: optionalUrlSchema,
    timezone: z
      .string()
      .max(50)
      .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format')
      .optional(),
    locale: z
      .string()
      .max(10)
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale format (e.g., en-US)')
      .optional(),

    // Role (admin only, defaults to member)
    role: UserRole.default('member'),

    // Metadata (limited size)
    metadata: z
      .record(z.string().max(100), z.unknown())
      .refine(
        (obj) => JSON.stringify(obj).length <= 10000,
        'Metadata too large (max 10KB)'
      )
      .optional(),
  })
  .strict(); // Reject unknown fields

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * Update User schema.
 * All fields optional, still rejects unknown fields.
 */
export const UpdateUserSchema = z
  .object({
    firstName: z
      .string()
      .min(1)
      .max(50)
      .transform((val) => normalizeName(val))
      .optional(),
    lastName: z
      .string()
      .min(1)
      .max(50)
      .transform((val) => normalizeName(val))
      .optional(),
    phone: optionalPhoneSchema,
    title: z
      .string()
      .max(100)
      .transform((val) => val.trim())
      .optional(),
    department: z
      .string()
      .max(100)
      .transform((val) => val.trim())
      .optional(),
    avatarUrl: optionalUrlSchema,
    timezone: z
      .string()
      .max(50)
      .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/)
      .optional(),
    locale: z
      .string()
      .max(10)
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional(),
    status: UserStatus.optional(),
    metadata: z
      .record(z.string().max(100), z.unknown())
      .refine((obj) => JSON.stringify(obj).length <= 10000)
      .optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================================================
// Deal Schemas
// ============================================================================

/**
 * Deal stage enum.
 */
export const DealStage = z.enum([
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);
export type DealStage = z.infer<typeof DealStage>;

/**
 * Deal priority enum.
 */
export const DealPriority = z.enum(['low', 'medium', 'high', 'critical']);
export type DealPriority = z.infer<typeof DealPriority>;

/**
 * Deal source enum.
 */
export const DealSource = z.enum([
  'inbound',
  'outbound',
  'referral',
  'partner',
  'marketing',
  'event',
  'other',
]);
export type DealSource = z.infer<typeof DealSource>;

/**
 * Contact schema (embedded in Deal).
 */
export const DealContactSchema = z
  .object({
    id: optionalUuidSchema,
    name: z
      .string()
      .min(1, 'Contact name is required')
      .max(100)
      .transform((val) => normalizeName(val)),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
    title: z.string().max(100).optional(),
    role: z.enum(['champion', 'decision_maker', 'influencer', 'blocker', 'end_user']).optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

export type DealContact = z.infer<typeof DealContactSchema>;

/**
 * Create Deal schema.
 */
export const CreateDealSchema = z
  .object({
    // Required fields
    name: z
      .string()
      .min(1, 'Deal name is required')
      .max(200, 'Deal name must be 200 characters or less')
      .transform((val) => val.trim()),
    companyName: z
      .string()
      .min(1, 'Company name is required')
      .max(200, 'Company name must be 200 characters or less')
      .transform((val) => normalizeCompanyName(val)),
    value: currencySchema,

    // Optional fields with defaults
    stage: DealStage.default('prospecting'),
    priority: DealPriority.default('medium'),
    probability: percentageSchema.default(0),

    // Optional fields
    companyId: optionalUuidSchema,
    description: descriptionSchema,
    source: DealSource.optional(),
    expectedCloseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .transform((val) => new Date(val))
      .refine((date) => date > new Date(), 'Expected close date must be in the future')
      .optional(),

    // Contacts (max 20)
    contacts: z
      .array(DealContactSchema)
      .max(20, 'Maximum 20 contacts allowed')
      .default([]),

    // Owner assignment
    ownerId: optionalUuidSchema,

    // Tags (max 20, each max 50 chars)
    tags: tagsSchema,

    // Custom fields (limited size)
    customFields: z
      .record(
        z.string().max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid field name'),
        z.union([
          z.string().max(1000),
          z.number(),
          z.boolean(),
          z.null(),
        ])
      )
      .refine(
        (obj) => Object.keys(obj).length <= 50,
        'Maximum 50 custom fields allowed'
      )
      .refine(
        (obj) => JSON.stringify(obj).length <= 50000,
        'Custom fields too large (max 50KB)'
      )
      .optional(),

    // Notes (sanitized, max 10KB)
    notes: sanitizedString({ maxLength: 10000, stripHtml: true }).optional(),

    // Metadata
    metadata: z
      .record(z.string().max(100), z.unknown())
      .refine((obj) => JSON.stringify(obj).length <= 10000)
      .optional(),
  })
  .strict();

export type CreateDealInput = z.infer<typeof CreateDealSchema>;

/**
 * Update Deal schema.
 */
export const UpdateDealSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((val) => val.trim())
      .optional(),
    companyName: z
      .string()
      .min(1)
      .max(200)
      .transform((val) => normalizeCompanyName(val))
      .optional(),
    companyId: optionalUuidSchema,
    value: currencySchema.optional(),
    stage: DealStage.optional(),
    priority: DealPriority.optional(),
    probability: percentageSchema.optional(),
    description: descriptionSchema,
    source: DealSource.optional(),
    expectedCloseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform((val) => new Date(val))
      .optional()
      .nullable(),
    actualCloseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform((val) => new Date(val))
      .optional()
      .nullable(),
    contacts: z.array(DealContactSchema).max(20).optional(),
    ownerId: optionalUuidSchema,
    tags: tagsSchema.optional(),
    customFields: z
      .record(
        z.string().max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
        z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])
      )
      .refine((obj) => Object.keys(obj).length <= 50)
      .refine((obj) => JSON.stringify(obj).length <= 50000)
      .optional(),
    notes: sanitizedString({ maxLength: 10000, stripHtml: true }).optional(),
    lostReason: z
      .string()
      .max(500)
      .transform((val) => val.trim())
      .optional(),
    metadata: z
      .record(z.string().max(100), z.unknown())
      .refine((obj) => JSON.stringify(obj).length <= 10000)
      .optional(),
  })
  .strict();

export type UpdateDealInput = z.infer<typeof UpdateDealSchema>;

/**
 * List Deals query schema.
 */
export const ListDealsQuerySchema = z
  .object({
    // Filters
    stage: DealStage.optional(),
    priority: DealPriority.optional(),
    source: DealSource.optional(),
    ownerId: uuidSchema.optional(),
    companyId: uuidSchema.optional(),
    minValue: z.coerce.number().nonnegative().optional(),
    maxValue: z.coerce.number().nonnegative().optional(),
    tags: z
      .string()
      .transform((val) => val.split(',').map((t) => t.trim().toLowerCase()))
      .optional(),
    search: z
      .string()
      .max(100)
      .transform((val) => val.trim())
      .optional(),
    closedAfter: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    closedBefore: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),

    // Pagination
    page: pageSchema,
    limit: limitSchema,

    // Sorting
    sortBy: z
      .enum(['created_at', 'updated_at', 'name', 'value', 'expected_close_date', 'probability'])
      .default('updated_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(
    (data) => {
      if (data.minValue !== undefined && data.maxValue !== undefined) {
        return data.minValue <= data.maxValue;
      }
      return true;
    },
    { message: 'minValue must be less than or equal to maxValue' }
  );

export type ListDealsQuery = z.infer<typeof ListDealsQuerySchema>;
