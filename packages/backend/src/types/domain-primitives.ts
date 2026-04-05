import { z } from "zod";

export const EvidenceRefSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["crm", "transcript", "benchmark", "financial_report", "interview", "product_telemetry", "other"]),
  source: z.string().min(1),
  reference: z.string().min(1),
  excerpt: z.string().min(1).optional(),
  capturedAt: z.string().datetime().optional(),
  url: z.string().url().optional(),
}).strict();

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const ConfidenceScoreSchema = z.object({
  score: z.number().finite().min(0).max(1),
  basis: z.enum(["evidence-backed", "benchmark-backed", "mixed", "assumption-heavy", "expert-judgment"]),
  explanation: z.string().min(1),
  evidenceCount: z.number().int().min(0).default(0),
}).strict().superRefine((value, ctx) => {
  if (value.score >= 0.9 && value.evidenceCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "confidence >= 0.90 requires at least one evidence reference",
      path: ["evidenceCount"],
    });
  }

  if (value.score <= 0.2 && value.basis === "evidence-backed") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "very low confidence should not be labeled evidence-backed",
      path: ["basis"],
    });
  }
});

export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;

export const AssumptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  category: z.enum(["baseline", "improvement", "cost", "risk", "timing", "adoption", "other"]),
  value: z.number().finite(),
  unit: z.string().min(1).optional(),
  direction: z.enum(["increase", "decrease", "neutral"]).optional(),
  rationale: z.string().min(1),
  confidence: ConfidenceScoreSchema,
  evidence: z.array(EvidenceRefSchema).default([]),
  sourceType: z.enum([
    "customer-confirmed",
    "crm-derived",
    "call-derived",
    "note-derived",
    "benchmark-derived",
    "externally-researched",
    "inferred",
    "manually-overridden",
  ]),
}).strict();

export type Assumption = z.infer<typeof AssumptionSchema>;

export const StakeholderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  role: z.string().min(1),
  buyingRole: z.enum(["economic_buyer", "champion", "technical_buyer", "influencer", "blocker", "end_user", "other"]),
  department: z.string().min(1).optional(),
  influenceLevel: z.number().int().min(1).max(5),
  sentiment: z.enum(["positive", "neutral", "negative", "unknown"]).default("unknown"),
  confidence: ConfidenceScoreSchema,
  evidence: z.array(EvidenceRefSchema).default([]),
}).strict();

export type Stakeholder = z.infer<typeof StakeholderSchema>;
