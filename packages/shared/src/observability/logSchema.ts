import { z } from "zod";

export const structuredLogSeveritySchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);

export const structuredLogSchema = z.object({
  timestamp: z.string().datetime(),
  severity: structuredLogSeveritySchema,
  service: z.string().min(1),
  env: z.string().min(1),
  tenant_id: z.string().min(1),
  trace_id: z.string().min(1),
  span_id: z.string().min(1),
  event: z.string().min(1),
  outcome: z.enum(["success", "failure", "unknown"]),
}).passthrough();

export type StructuredLogSeverity = z.infer<typeof structuredLogSeveritySchema>;
export type StructuredLogEntry = z.infer<typeof structuredLogSchema>;
