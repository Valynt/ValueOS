import { assertTenantContextMatch } from "../../lib/tenant/assertTenantContextMatch.js";
import { isExternalArtifactWorkflowStage } from "./externalArtifactPolicy.js";
import type { WorkflowStageContextDTO } from "../../types/workflow/runner.js";
import type { WorkflowStage } from "../../types/workflow.js";
import type { DecisionContext } from "@shared/domain/DecisionContext.js";

export function buildStageContextWithTenantValidation(
  authoritativeOrganizationId: string,
  context: WorkflowStageContextDTO,
  source: string
): WorkflowStageContextDTO {
  assertTenantContextMatch({
    expectedTenantId: authoritativeOrganizationId,
    actualTenantId: context.organizationId,
    source: `${source}.organizationId`,
  });
  assertTenantContextMatch({
    expectedTenantId: authoritativeOrganizationId,
    actualTenantId: context.organization_id,
    source: `${source}.organization_id`,
  });
  assertTenantContextMatch({
    expectedTenantId: authoritativeOrganizationId,
    actualTenantId: context.tenantId,
    source: `${source}.tenantId`,
  });

  return {
    ...context,
    organizationId: authoritativeOrganizationId,
    organization_id: authoritativeOrganizationId,
    tenantId: authoritativeOrganizationId,
  };
}

export function buildWorkflowStageDecisionContext(
  stage: WorkflowStage,
  context: WorkflowStageContextDTO
): DecisionContext {
  const confidence =
    typeof context.opportunity_confidence_score === "number"
      ? context.opportunity_confidence_score
      : typeof context.confidence_score === "number"
        ? context.confidence_score
        : 0.5;

  const organizationId = String(
    context.organizationId ?? context.organization_id ?? context.tenantId ?? ""
  );
  const opportunityId = String(
    context.opportunityId ??
      context.opportunity_id ??
      "00000000-0000-0000-0000-000000000000"
  );

  return {
    organization_id: organizationId,
    opportunity: {
      id: opportunityId,
      lifecycle_stage: stage.agent_type,
      confidence_score: confidence,
      value_maturity: "low",
    },
    is_external_artifact_action: isExternalArtifactWorkflowStage(stage),
  };
}
