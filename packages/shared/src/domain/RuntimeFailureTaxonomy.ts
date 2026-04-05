import { z } from "zod";

export const RuntimeFailureClassSchema = z.enum([
  "transient-degraded",
  "policy-blocked",
  "data-missing",
  "execution-failed",
  "dependency-unavailable",
]);

export type RuntimeFailureClass = z.infer<typeof RuntimeFailureClassSchema>;

export const RuntimeFailureSeveritySchema = z.enum(["degraded", "failed"]);
export type RuntimeFailureSeverity = z.infer<typeof RuntimeFailureSeveritySchema>;

export const RemediationActionSchema = z.enum([
  "retry",
  "reroute-owner",
  "provide-missing-artifact",
  "request-override",
  "escalate-approval-inbox",
]);

export type RemediationAction = z.infer<typeof RemediationActionSchema>;

export interface RuntimeRemediationPlaybook {
  readonly actions: readonly RemediationAction[];
  readonly owner: "requester" | "workflow-owner" | "policy-admin" | "platform-ops";
  readonly title: string;
  readonly guidance: string;
}

export const RUNTIME_FAILURE_PLAYBOOKS: Record<RuntimeFailureClass, RuntimeRemediationPlaybook> = {
  "transient-degraded": {
    actions: ["retry", "reroute-owner"],
    owner: "workflow-owner",
    title: "Transient degradation",
    guidance: "Retry automatically first; reroute to workflow owner if retries are exhausted.",
  },
  "policy-blocked": {
    actions: ["request-override", "reroute-owner", "escalate-approval-inbox"],
    owner: "policy-admin",
    title: "Policy blocked execution",
    guidance: "Request an explicit policy override and escalate to Approval Inbox when required.",
  },
  "data-missing": {
    actions: ["provide-missing-artifact", "retry"],
    owner: "requester",
    title: "Required artifact missing",
    guidance: "Provide the missing artifact/data, then retry deterministically.",
  },
  "execution-failed": {
    actions: ["retry", "reroute-owner"],
    owner: "workflow-owner",
    title: "Execution failure",
    guidance: "Retry once under same inputs; reroute owner when repeated failures are detected.",
  },
  "dependency-unavailable": {
    actions: ["retry", "reroute-owner", "escalate-approval-inbox"],
    owner: "platform-ops",
    title: "Dependency unavailable",
    guidance: "Retry with backoff while notifying platform owner and optional approval escalation.",
  },
} as const;

export const RuntimeFailureDetailsSchema = z.object({
  class: RuntimeFailureClassSchema,
  severity: RuntimeFailureSeveritySchema,
  machineReasonCode: z.string().min(1),
  diagnosis: z.string().min(1),
  recommendedNextActions: z.array(RemediationActionSchema).min(1),
  confidence: z.number().min(0).max(1),
  blastRadiusEstimate: z.enum(["single-stage", "workflow", "tenant-wide"]),
  owner: z.enum(["requester", "workflow-owner", "policy-admin", "platform-ops"]),
  playbookTitle: z.string().min(1),
  playbookGuidance: z.string().min(1),
});

export type RuntimeFailureDetails = z.infer<typeof RuntimeFailureDetailsSchema>;

export function buildRuntimeFailureDetails(input: {
  class: RuntimeFailureClass;
  severity: RuntimeFailureSeverity;
  machineReasonCode: string;
  diagnosis: string;
  confidence: number;
  blastRadiusEstimate: RuntimeFailureDetails["blastRadiusEstimate"];
  recommendedNextActions?: readonly RemediationAction[];
}): RuntimeFailureDetails {
  const playbook = RUNTIME_FAILURE_PLAYBOOKS[input.class];
  return {
    class: input.class,
    severity: input.severity,
    machineReasonCode: input.machineReasonCode,
    diagnosis: input.diagnosis,
    recommendedNextActions: [...(input.recommendedNextActions ?? playbook.actions)],
    confidence: Math.max(0, Math.min(1, input.confidence)),
    blastRadiusEstimate: input.blastRadiusEstimate,
    owner: playbook.owner,
    playbookTitle: playbook.title,
    playbookGuidance: playbook.guidance,
  };
}
