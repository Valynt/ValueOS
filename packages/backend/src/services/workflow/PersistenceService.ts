import { featureFlags } from "../../config/featureFlags.js";
import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";
import { CanvasComponent } from "../../types";

export interface BusinessCase {
  id: string;
  name: string;
  client: string;
  status: "draft" | "in-review" | "presented";
  owner_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  component_id: string;
  organization_id: string;
  action_type: "created" | "updated" | "deleted" | "moved" | "resized";
  actor: string;
  changes: Record<string, unknown>;
  timestamp: string;
}

export interface AgentActivity {
  id: string;
  case_id: string;
  organization_id: string;
  agent_name: string;
  activity_type:
    | "suggestion"
    | "calculation"
    | "visualization"
    | "narrative"
    | "data-import";
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export class PersistenceService {
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 2000;

  private requireOrganizationId(
    organizationId: string | undefined,
    method: string
  ): string {
    if (!organizationId) {
      throw new Error(
        `PersistenceService.${method} requires organizationId`
      );
    }

    return organizationId;
  }

  async createBusinessCase(
    organizationId: string,
    name: string,
    client: string,
    userId: string
  ): Promise<BusinessCase | null> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "createBusinessCase"
    );

    if (featureFlags.DISABLE_LEGACY_BUSINESS_CASES) {
      throw new Error(
        "Creation of legacy business cases is disabled via feature flag"
      );
    }

    logger.warn(
      "DEPRECATION: PersistenceService.createBusinessCase is deprecated. Use ValueCaseService instead."
    );

    const { data, error } = await supabase
      .from("business_cases")
      .insert({
        organization_id: scopedOrganizationId,
        name,
        client,
        status: "draft",
        owner_id: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        "Error creating business case",
        error instanceof Error ? error : undefined
      );
      return null;
    }

    return data as BusinessCase;
  }

  async getBusinessCase(
    organizationId: string,
    caseId: string
  ): Promise<BusinessCase | null> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "getBusinessCase"
    );

    if (featureFlags.DISABLE_LEGACY_BUSINESS_CASES) {
      return null;
    }

    logger.warn(
      "DEPRECATION: PersistenceService.getBusinessCase is deprecated. Use ValueCaseService instead.",
      { caseId, organizationId: scopedOrganizationId }
    );

    const { data, error } = await supabase
      .from("business_cases")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("id", caseId)
      .single();

    if (error) {
      logger.error(
        "Error fetching business case",
        error instanceof Error ? error : undefined
      );
      return null;
    }

    return data as BusinessCase;
  }

  async updateBusinessCase(
    organizationId: string,
    caseId: string,
    updates: Partial<BusinessCase>
  ): Promise<boolean> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "updateBusinessCase"
    );

    if (featureFlags.DISABLE_LEGACY_BUSINESS_CASES) {
      throw new Error(
        "Updates to legacy business cases are disabled via feature flag"
      );
    }

    logger.warn(
      "DEPRECATION: PersistenceService.updateBusinessCase is deprecated. Use ValueCaseService instead.",
      { caseId, organizationId: scopedOrganizationId }
    );

    const { organization_id: _ignoredOrganizationId, ...scopedUpdates } = updates;

    const { data, error } = await supabase
      .from("business_cases")
      .update({
        ...scopedUpdates,
        organization_id: scopedOrganizationId,
      })
      .eq("id", caseId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      logger.error(
        "Error updating business case",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    return Boolean(data);
  }

  async saveComponent(
    organizationId: string,
    caseId: string,
    component: CanvasComponent,
    actor: string = "user"
  ): Promise<string | null> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "saveComponent"
    );

    const { data, error } = await supabase
      .from("canvas_components")
      .insert({
        organization_id: scopedOrganizationId,
        case_id: caseId,
        type: component.type,
        position_x: component.position.x,
        position_y: component.position.y,
        width: component.size.width,
        height: component.size.height,
        props: component.props,
        created_by: actor,
        is_dirty: false,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        "Error saving component",
        error instanceof Error ? error : undefined
      );
      return null;
    }

    await this.logHistory(scopedOrganizationId, data.id, "created", actor, {
      type: component.type,
      position: component.position,
      size: component.size,
    });

    return data.id;
  }

  async updateComponent(
    organizationId: string,
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = "user"
  ): Promise<boolean> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "updateComponent"
    );

    const dbUpdates: Partial<{
      organization_id: string;
      position_x: number;
      position_y: number;
      width: number;
      height: number;
      props: Record<string, unknown>;
      is_dirty: boolean;
    }> = {
      organization_id: scopedOrganizationId,
    };

    if (updates.position) {
      dbUpdates.position_x = updates.position.x;
      dbUpdates.position_y = updates.position.y;
    }

    if (updates.size) {
      dbUpdates.width = updates.size.width;
      dbUpdates.height = updates.size.height;
    }

    if (updates.props) {
      dbUpdates.props = updates.props as Record<string, unknown>;
    }

    dbUpdates.is_dirty = false;

    const { data, error } = await supabase
      .from("canvas_components")
      .update(dbUpdates)
      .eq("id", componentId)
      .eq("organization_id", scopedOrganizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      logger.error(
        "Error updating component",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    if (!data) {
      return false;
    }

    const actionType =
      updates.position && !updates.size
        ? "moved"
        : updates.size && !updates.position
          ? "resized"
          : "updated";

    await this.logHistory(
      scopedOrganizationId,
      componentId,
      actionType,
      actor,
      updates
    );

    return true;
  }

  debouncedUpdateComponent(
    organizationId: string,
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = "user"
  ): void {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "debouncedUpdateComponent"
    );

    const saveKey = `${scopedOrganizationId}:${componentId}`;

    if (this.saveQueue.has(saveKey)) {
      clearTimeout(this.saveQueue.get(saveKey)!);
    }

    const timeout = setTimeout(() => {
      void this.updateComponent(scopedOrganizationId, componentId, updates, actor);
      this.saveQueue.delete(saveKey);
    }, this.DEBOUNCE_MS);

    this.saveQueue.set(saveKey, timeout);
  }

  async deleteComponent(
    organizationId: string,
    componentId: string,
    actor: string = "user"
  ): Promise<boolean> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "deleteComponent"
    );

    const { data, error } = await supabase
      .from("canvas_components")
      .delete()
      .eq("id", componentId)
      .eq("organization_id", scopedOrganizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      logger.error(
        "Error deleting component",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    if (!data) {
      return false;
    }

    await this.logHistory(scopedOrganizationId, componentId, "deleted", actor, {});

    return true;
  }

  async loadComponents(
    organizationId: string,
    caseId: string
  ): Promise<CanvasComponent[]> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "loadComponents"
    );

    const { data, error } = await supabase
      .from("canvas_components")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error(
        "Error loading components",
        error instanceof Error ? error : undefined
      );
      return [];
    }

    return data.map(
      (component: {
        id: string;
        type: string;
        position_x: number;
        position_y: number;
        width: number;
        height: number;
        props: Record<string, unknown>;
      }) => ({
        id: component.id,
        type: component.type,
        position: { x: component.position_x, y: component.position_y },
        size: { width: component.width, height: component.height },
        props: component.props,
      })
    );
  }

  async logHistory(
    organizationId: string,
    componentId: string,
    actionType: "created" | "updated" | "deleted" | "moved" | "resized",
    actor: string,
    changes: unknown
  ): Promise<void> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "logHistory"
    );

    const { error } = await supabase.from("component_history").insert({
      organization_id: scopedOrganizationId,
      component_id: componentId,
      action_type: actionType,
      actor,
      changes,
    });

    if (error) {
      logger.error(
        "Error logging history",
        error instanceof Error ? error : undefined
      );
    }
  }

  async getComponentHistory(
    organizationId: string,
    componentId: string
  ): Promise<HistoryEntry[]> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "getComponentHistory"
    );

    const { data, error } = await supabase
      .from("component_history")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("component_id", componentId)
      .order("timestamp", { ascending: false });

    if (error) {
      logger.error(
        "Error fetching component history",
        error instanceof Error ? error : undefined
      );
      return [];
    }

    return data as HistoryEntry[];
  }

  async getGlobalHistory(
    organizationId: string,
    caseId: string,
    limit: number = 50
  ): Promise<HistoryEntry[]> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "getGlobalHistory"
    );

    const { data, error } = await supabase
      .from("component_history")
      .select(
        `
        *,
        canvas_components!inner(case_id, organization_id)
      `
      )
      .eq("organization_id", scopedOrganizationId)
      .eq("canvas_components.case_id", caseId)
      .eq("canvas_components.organization_id", scopedOrganizationId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        "Error fetching global history",
        error instanceof Error ? error : undefined
      );
      return [];
    }

    return data as HistoryEntry[];
  }

  async logAgentActivity(
    organizationId: string,
    caseId: string,
    agentName: string,
    activityType:
      | "suggestion"
      | "calculation"
      | "visualization"
      | "narrative"
      | "data-import",
    title: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "logAgentActivity"
    );

    const { error } = await supabase.from("agent_activities").insert({
      organization_id: scopedOrganizationId,
      case_id: caseId,
      agent_name: agentName,
      activity_type: activityType,
      title,
      content,
      metadata,
    });

    if (error) {
      logger.error(
        "Error logging agent activity",
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAgentActivities(
    organizationId: string,
    caseId: string,
    limit: number = 50
  ): Promise<AgentActivity[]> {
    const scopedOrganizationId = this.requireOrganizationId(
      organizationId,
      "getAgentActivities"
    );

    const { data, error } = await supabase
      .from("agent_activities")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("case_id", caseId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        "Error fetching agent activities",
        error instanceof Error ? error : undefined
      );
      return [];
    }

    return data as AgentActivity[];
  }

  flushSaveQueue(): void {
    this.saveQueue.forEach(timeout => clearTimeout(timeout));
    this.saveQueue.clear();
  }
}

export const persistenceService = new PersistenceService();
