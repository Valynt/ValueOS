import { z } from "zod";

export const InitiativeStatusSchema = z.enum(["draft", "active", "archived"]);
export type InitiativeStatus = z.infer<typeof InitiativeStatusSchema>;

export const InitiativeCategorySchema = z.enum(["growth", "efficiency", "risk"]);
export type InitiativeCategory = z.infer<typeof InitiativeCategorySchema>;

const toLower = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const TagSchema = z
  .string()
  .trim()
  .min(1)
  .max(32);

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

const CreateInitiativeSchemaBase = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    status: z
      .preprocess(toLower, InitiativeStatusSchema)
      .default("draft"),
    category: z
      .preprocess(toLower, InitiativeCategorySchema)
      .default("growth"),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    ownerEmail: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    tags: z
      .array(TagSchema)
      .max(20)
      .default([])
      .transform((tags) => tags.map((tag) => tag.toLowerCase())),
    startDate: DateSchema.optional(),
    endDate: DateSchema.optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const withValidDates = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (value: { startDate?: string; endDate?: string }) =>
      !value.startDate ||
      !value.endDate ||
      value.endDate >= value.startDate,
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    }
  );

export const CreateInitiativeSchema = withValidDates(CreateInitiativeSchemaBase);

export type CreateInitiativeInput = z.infer<typeof CreateInitiativeSchema>;

export const UpdateInitiativeSchema = withValidDates(
  CreateInitiativeSchemaBase.partial().omit({ idempotencyKey: true })
).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided",
});

export type UpdateInitiativeInput = z.infer<typeof UpdateInitiativeSchema>;

export const ListInitiativesQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["created_at", "priority", "name"]).default("created_at"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
    status: z.preprocess(toLower, InitiativeStatusSchema).optional(),
    category: z.preprocess(toLower, InitiativeCategorySchema).optional(),
    ownerEmail: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase())
      .optional(),
    priorityMin: z.coerce.number().int().min(1).max(5).optional(),
    priorityMax: z.coerce.number().int().min(1).max(5).optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.priorityMin === undefined ||
      value.priorityMax === undefined ||
      value.priorityMin <= value.priorityMax,
    {
      message: "priorityMin must be less than or equal to priorityMax",
      path: ["priorityMin"],
    }
  );

export type ListInitiativesQuery = z.infer<typeof ListInitiativesQuerySchema>;

export type Initiative = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: InitiativeStatus;
  category: InitiativeCategory;
  priority: number;
  ownerEmail: string;
  tags: string[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor?: string;
};

export type ApiErrorResponse = {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};
