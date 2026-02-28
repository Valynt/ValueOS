/**
 * Database boundary validation for Value Drivers.
 */

import { z } from 'zod';

import {
  createEnumMapper,
  sanitizedOptionalString,
  sanitizedString,
} from '../../lib/db/validation';

import {
  DriverStatus,
  DriverType,
  FormulaSchema,
  PersonaTag,
  SalesMotionTag,
} from './types';

const NAME_LIMIT = 100;
const DESCRIPTION_LIMIT = 500;
const NARRATIVE_LIMIT = 500;
const SEARCH_LIMIT = 100;

const DriverTypeDbMap = {
  cost_savings: 'cost_savings',
  revenue_lift: 'revenue_lift',
  productivity_gain: 'productivity_gain',
  risk_mitigation: 'risk_mitigation',
} as const;

const DriverStatusDbMap = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
} as const;

export type DbDriverType = typeof DriverTypeDbMap[keyof typeof DriverTypeDbMap];
export type DbDriverStatus = typeof DriverStatusDbMap[keyof typeof DriverStatusDbMap];

export const mapDriverTypeToDb = createEnumMapper(DriverTypeDbMap);
export const mapDriverStatusToDb = createEnumMapper(DriverStatusDbMap);

const NameSchema = sanitizedString({
  min: 1,
  max: NAME_LIMIT,
  normalizeWhitespace: true,
  label: 'Name',
});

const DescriptionSchema = sanitizedOptionalString({
  max: DESCRIPTION_LIMIT,
  normalizeWhitespace: true,
  label: 'Description',
});

const NarrativeSchema = sanitizedString({
  min: 1,
  max: NARRATIVE_LIMIT,
  normalizeWhitespace: true,
  label: 'Narrative pitch',
});

const SearchSchema = sanitizedOptionalString({
  max: SEARCH_LIMIT,
  normalizeWhitespace: true,
  lowercase: true,
  label: 'Search term',
});

export const CreateValueDriverDbSchema = z
  .object({
    name: NameSchema,
    description: DescriptionSchema,
    type: DriverType,
    personaTags: z.array(PersonaTag).min(1).max(8),
    salesMotionTags: z.array(SalesMotionTag).min(1).max(5),
    formula: FormulaSchema,
    narrativePitch: NarrativeSchema,
    status: DriverStatus.default('draft'),
  })
  .strict();

export const UpdateValueDriverDbSchema = z
  .object({
    name: NameSchema.optional(),
    description: DescriptionSchema.optional(),
    type: DriverType.optional(),
    personaTags: z.array(PersonaTag).min(1).max(8).optional(),
    salesMotionTags: z.array(SalesMotionTag).min(1).max(5).optional(),
    formula: FormulaSchema.optional(),
    narrativePitch: NarrativeSchema.optional(),
    status: DriverStatus.optional(),
  })
  .strict();

export const ListValueDriversQueryDbSchema = z
  .object({
    type: DriverType.optional(),
    status: DriverStatus.optional(),
    persona: PersonaTag.optional(),
    salesMotion: SalesMotionTag.optional(),
    search: SearchSchema.optional(),
    sortBy: z.enum(['created_at', 'updated_at', 'name', 'usage_count']).default('updated_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
