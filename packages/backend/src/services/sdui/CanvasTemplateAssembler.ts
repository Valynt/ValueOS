import { generateSOFExpansionPage } from "@sdui/templates/sof-expansion-template";
import { generateSOFIntegrityPage } from "@sdui/templates/sof-integrity-template";
import { generateSOFOpportunityPage } from "@sdui/templates/sof-opportunity-template";
import { generateSOFRealizationPage } from "@sdui/templates/sof-realization-template";
import { generateSOFTargetPage } from "@sdui/templates/sof-target-template";
import { SDUIPageDefinition } from "@valueos/sdui";

import { logger } from "../../lib/logger.js";
import {
  CanonicalAction,
  WorkspaceContext,
  WorkspaceData,
  WorkspaceState,
} from "../../types/sdui-integration";
import { LifecycleStage } from "../../types/workflow";

export class CanvasTemplateAssembler {
  selectTemplate(state: WorkspaceState, _data: unknown): LifecycleStage {
    return (state.lifecycleStage ??
      state.lifecycle_stage ??
      "opportunity") as LifecycleStage;
  }

  async generateSchemaFromTemplate(
    template: LifecycleStage,
    data: WorkspaceData,
    _state: WorkspaceState
  ): Promise<SDUIPageDefinition> {
    switch (template) {
      case "opportunity":
        return generateSOFOpportunityPage(data);
      case "target":
        return generateSOFTargetPage(data);
      case "expansion":
        return generateSOFExpansionPage(data);
      case "integrity":
        return generateSOFIntegrityPage(data);
      case "realization":
        return generateSOFRealizationPage(data);
      default:
        logger.warn("Unknown template", { template });
        return this.generateFallbackSchema(template);
    }
  }

  generateFallbackSchema(stage: LifecycleStage): SDUIPageDefinition {
    return {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "InfoBanner",
          version: 1,
          props: {
            title: "Loading Workspace",
            description: `Preparing ${stage} stage...`,
            tone: "info",
          },
        },
      ],
    };
  }

  extractContextFromAction(action: CanonicalAction): WorkspaceContext {
    const baseContext: WorkspaceContext = {
      workspace_id: action.workspaceId ?? "",
      organization_id: action.context?.organization_id ?? "",
      user_id: action.context?.user_id ?? "",
      lifecycle_stage: "opportunity",
      permissions: {
        can_edit: true,
        can_view: true,
        can_delete: false,
        can_share: false,
      } as unknown as import("../../types/sdui-integration").WorkspacePermissions,
    };

    const payload = action.payload as
      | Record<string, unknown>
      | undefined;
    if (payload?.stage && typeof payload.stage === "string") {
      baseContext.lifecycle_stage = payload.stage;
      baseContext.lifecycleStage = payload.stage;
    }

    return baseContext;
  }
}
