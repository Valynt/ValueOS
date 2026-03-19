import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = Record<string, JsonValue>;

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(jsonValueSchema);

export function isJsonObject(value: unknown): value is JsonObject {
  return jsonObjectSchema.safeParse(value).success;
}
