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
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  component_id: string;
  action_type: "created" | "updated" | "deleted" | "moved" | "resized";
  actor: string;
  changes: Record<string, unknown>;
  timestamp: string;
}

export interface AgentActivity {
  id: string;
  case_id: string;
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

class PersistenceService {
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 2000;

  async createBusinessCase(
    name: string,
    client: string,
    userId: string
  ): Promise<BusinessCase | null> {
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

  async getBusinessCase(caseId: string): Promise<BusinessCase | null> {
    if (featureFlags.DISABLE_LEGACY_BUSINESS_CASES) {
      return null;
    }

    logger.warn(
      "DEPRECATION: PersistenceService.getBusinessCase is deprecated. Use ValueCaseService instead.",
      { caseId }
    );

    const { data, error } = await supabase
      .from("business_cases")
      .select("*")
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
    caseId: string,
    updates: Partial<BusinessCase>
  ): Promise<boolean> {
    if (featureFlags.DISABLE_LEGACY_BUSINESS_CASES) {
      throw new Error(
        "Updates to legacy business cases are disabled via feature flag"
      );
    }

    logger.warn(
      "DEPRECATION: PersistenceService.updateBusinessCase is deprecated. Use ValueCaseService instead.",
      { caseId }
    );

    const { error } = await supabase
      .from("business_cases")
      .update(updates)
      .eq("id", caseId);

    if (error) {
      logger.error(
        "Error updating business case",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    return true;
  }

  async saveComponent(
    caseId: string,
    component: CanvasComponent,
    actor: string = "user"
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from("canvas_components")
      .insert({
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

    await this.logHistory(data.id, "created", actor, {
      type: component.type,
      position: component.position,
      size: component.size,
    });

    return data.id;
  }

  async updateComponent(
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = "user"
  ): Promise<boolean> {
    const dbUpdates: Partial<{
      position_x: number;
      position_y: number;
      width: number;
      height: number;
      props: Record<string, unknown>;
      is_dirty: boolean;
    }> = {};

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

    const { error } = await supabase
      .from("canvas_components")
      .update(dbUpdates)
      .eq("id", componentId);

    if (error) {
      logger.error(
        "Error updating component",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    const actionType =
      updates.position && !updates.size
        ? "moved"
        : updates.size && !updates.position
          ? "resized"
          : "updated";

    await this.logHistory(componentId, actionType, actor, updates);

    return true;
  }

  debouncedUpdateComponent(
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = "user"
  ): void {
    if (this.saveQueue.has(componentId)) {
      clearTimeout(this.saveQueue.get(componentId)!);
    }

    const timeout = setTimeout(() => {
      this.updateComponent(componentId, updates, actor);
      this.saveQueue.delete(componentId);
    }, this.DEBOUNCE_MS);

    this.saveQueue.set(componentId, timeout);
  }

  async deleteComponent(
    componentId: string,
    actor: string = "user"
  ): Promise<boolean> {
    await this.logHistory(componentId, "deleted", actor, {});

    const { error } = await supabase
      .from("canvas_components")
      .delete()
      .eq("id", componentId);

    if (error) {
      logger.error(
        "Error deleting component",
        error instanceof Error ? error : undefined
      );
      return false;
    }

    return true;
  }

  async loadComponents(caseId: string): Promise<CanvasComponent[]> {
    const { data, error } = await supabase
      .from("canvas_components")
      .select("*")
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
    componentId: string,
    actionType: "created" | "updated" | "deleted" | "moved" | "resized",
    actor: string,
    changes: unknown
  ): Promise<void>;
  async logHistory(
    organizationId: string,
    componentId: string,
    actionType: "created" | "updated" | "deleted" | "moved" | "resized",
    actor: string,
    changes: unknown
  ): Promise<void>;
  async logHistory(...args: unknown[]): Promise<void> {
    if (args.length === 5) {
      // Full signature (organizationId, componentId, actionType, actor, changes)
      const [organizationId, componentId, actionType, actor, changes] =
        args as [
          string,
          string,
          "created" | "updated" | "deleted" | "moved" | "resized",
          string,
          unknown,
        ];
      if (!organizationId) {
        logger.error(
          "logHistory called without organizationId — skipping to prevent cross-tenant leak"
        );
        return;
      }
      const { error } = await supabase.from("component_history").insert({
        organization_id: organizationId,
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
      return;
    } else if (args.length === 4) {
      // Deprecated signature (componentId, actionType, actor, changes)
      logger.error(
        "logHistory called without organizationId — skipping to prevent cross-tenant leak"
      );
      return;
    }
  }

  async getComponentHistory(componentId: string): Promise<HistoryEntry[]> {
    const { data, error } = await supabase
      .from("component_history")
      .select("*")
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
    caseId: string,
    limit: number = 50
  ): Promise<HistoryEntry[]> {
    const { data, error } = await supabase
      .from("component_history")
      .select(
        `
        *,
        canvas_components!inner(case_id)
      `
      )
      .eq("canvas_components.case_id", caseId)
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
    if (!organizationId) {
      logger.error(
        "logAgentActivity called without organizationId — skipping to prevent cross-tenant leak"
      );
      return;
    }

    const { error } = await supabase.from("agent_activities").insert({
      organization_id: organizationId,
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
    caseId: string,
    limit: number = 50
  ): Promise<AgentActivity[]> {
    const { data, error } = await supabase
      .from("agent_activities")
      .select("*")
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
