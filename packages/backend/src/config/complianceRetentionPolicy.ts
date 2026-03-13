import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const frameworkWindowSchema = z.object({
  operational_days: z.number().int().positive(),
  archive_years: z.number().int().positive(),
});

const retentionClassSchema = z.object({
  id: z.string(),
  data_class: z.string(),
  framework_windows: z.record(frameworkWindowSchema),
  default_window: frameworkWindowSchema,
  legal_hold: z.boolean(),
  archive_target: z.string(),
  worm: z.object({
    object_lock_mode: z.enum(["COMPLIANCE", "GOVERNANCE"]),
    default_retain_years: z.number().int().positive(),
    legal_hold_required: z.boolean(),
  }),
});

const retentionPolicySchema = z.object({
  version: z.string(),
  policy_id: z.string(),
  reviewed_at: z.string(),
  classes: z.array(retentionClassSchema),
});

export type ComplianceRetentionPolicy = z.infer<typeof retentionPolicySchema>;

const policyPathCandidates = [
  path.resolve(process.cwd(), "infra/retention/security-audit-retention-policy.v1.json"),
  path.resolve(process.cwd(), "../../infra/retention/security-audit-retention-policy.v1.json"),
];

function resolvePolicyPath(): string {
  for (const candidate of policyPathCandidates) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // Continue trying candidates.
    }
  }

  throw new Error("Unable to locate infra retention policy config file");
}

export function readComplianceRetentionPolicy(): ComplianceRetentionPolicy {
  const raw = readFileSync(resolvePolicyPath(), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return retentionPolicySchema.parse(parsed);
}
