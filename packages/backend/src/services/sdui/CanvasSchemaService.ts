/**
 * Canvas Schema Service
 *
 * Thin facade that coordinates workspace state loading, schema assembly,
 * and cache/CAS persistence without forcing broad call-site rewrites.
 */

import { AtomicUIAction, ComponentSelector } from "@sdui/AtomicUIActions";
import { SDUIPageDefinition } from "@valueos/sdui";

import { logger } from "../../lib/logger.js";
import {
  ActionResult,
  CanonicalAction,
  WorkspaceContext,
} from "../../types/sdui-integration";
import { LifecycleStage } from "../../types/workflow";

import {
  applyAtomicActions,
  findComponentIndices,
} from "./CanvasActionApplier.js";
import {
  CanvasSchemaCache,
  SchemaHead,
} from "./CanvasSchemaCache.js";
import { CanvasTemplateAssembler } from "./CanvasTemplateAssembler.js";
import { CanvasWorkspaceDataLoader } from "./CanvasWorkspaceDataLoader.js";
import { SDUICacheService } from "./SDUICacheService.js";
import { ValueFabricService } from "./ValueFabricService.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { getSupabaseClient } from "../../lib/supabase.js";

export { CanvasSchemaCache, type SchemaHead } from "./CanvasSchemaCache.js";
export { CanvasTemplateAssembler } from "./CanvasTemplateAssembler.js";
export { CanvasWorkspaceDataLoader } from "./CanvasWorkspaceDataLoader.js";

export class CanvasSchemaService {
  private readonly cacheService: CanvasSchemaCache;
  private readonly workspaceDataLoader: CanvasWorkspaceDataLoader;
  private readonly templateAssembler: CanvasTemplateAssembler;

  constructor(
    cacheService?: SDUICacheService,
    valueFabricService?: ValueFabricService,
    schemaCache?: CanvasSchemaCache,
    workspaceDataLoader?: CanvasWorkspaceDataLoader,
    templateAssembler?: CanvasTemplateAssembler
  ) {
    const resolvedCacheService = cacheService || new SDUICacheService();
    const resolvedValueFabricService =
      valueFabricService || new ValueFabricService(getSupabaseClient());

    this.cacheService =
      schemaCache || new CanvasSchemaCache(resolvedCacheService);
    this.workspaceDataLoader =
      workspaceDataLoader ||
      new CanvasWorkspaceDataLoader(resolvedValueFabricService);
    this.templateAssembler = templateAssembler || new CanvasTemplateAssembler();
  }

  async generateSchema(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<SDUIPageDefinition> {
    logger.info("Generating SDUI schema", {
      workspaceId,
      lifecycleStage: context.lifecycleStage,
    });

    try {
      const cached = await this.getCachedSchema(workspaceId);
      if (cached) {
        logger.debug("Returning cached schema", { workspaceId });
        return cached;
      }

      const workspaceState = await this.detectWorkspaceState(
        workspaceId,
        context
      );
      const data = await this.fetchWorkspaceData(workspaceState);
      const template = this.templateAssembler.selectTemplate(workspaceState, data);
      const schema = await this.templateAssembler.generateSchemaFromTemplate(
        template,
        data,
        workspaceState
      );

      await this.cacheService.cacheSchema(workspaceId, schema);

      logger.info("Generated SDUI schema", {
        workspaceId,
        lifecycleStage: context.lifecycleStage,
        componentCount: schema.sections.length,
      });

      return schema;
    } catch (error) {
      logger.error("Failed to generate SDUI schema", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.templateAssembler.generateFallbackSchema(
        (context.lifecycleStage ?? "opportunity") as LifecycleStage
      );
    }
  }

  async updateSchema(
    workspaceId: string,
    action: CanonicalAction,
    result: ActionResult
  ): Promise<SDUIPageDefinition> {
    logger.info("Updating SDUI schema", {
      workspaceId,
      actionType: action.type,
    });

    try {
      if (result.schemaUpdate) {
        const schemaUpdate = result.schemaUpdate as SDUIPageDefinition;
        await this.cacheService.cacheSchema(workspaceId, schemaUpdate);
        return schemaUpdate;
      }

      if (result.atomicActions && result.atomicActions.length > 0) {
        const currentSchema = await this.getCachedSchema(workspaceId);
        if (currentSchema) {
          const updatedSchema = await this.applyAtomicActions(
            currentSchema,
            result.atomicActions
          );
          await this.cacheService.cacheSchema(workspaceId, updatedSchema);
          return updatedSchema;
        }
      }

      await this.invalidateCache(workspaceId);
      const context = this.templateAssembler.extractContextFromAction(action);
      return await this.generateSchema(workspaceId, context);
    } catch (error) {
      logger.error("Failed to update SDUI schema", {
        workspaceId,
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      const cached = await this.getCachedSchema(workspaceId);
      if (cached) return cached;

      return this.templateAssembler.generateFallbackSchema("opportunity");
    }
  }

  async getCachedSchema(
    workspaceId: string
  ): Promise<SDUIPageDefinition | null> {
    return this.cacheService.getCachedSchema(workspaceId);
  }

  async invalidateCache(workspaceId: string): Promise<void> {
    await this.cacheService.invalidateCache(workspaceId);
  }

  async cacheSchemaWithCAS(
    workspaceId: string,
    schema: SDUIPageDefinition
  ): Promise<string> {
    return this.cacheService.cacheSchemaWithCAS(workspaceId, schema);
  }

  async getSchemaHead(workspaceId: string): Promise<SchemaHead | null> {
    return this.cacheService.getSchemaHead(workspaceId);
  }

  async getSchemaByHash(hash: string): Promise<SDUIPageDefinition | null> {
    return this.cacheService.getSchemaByHash(hash);
  }

  async getSchemaWithCAS(workspaceId: string): Promise<{
    schema: SDUIPageDefinition;
    hash: string;
    updatedAt: number;
  } | null> {
    return this.cacheService.getSchemaWithCAS(workspaceId);
  }

  async generateSchemaWithCAS(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<{ schema: SDUIPageDefinition; hash: string }> {
    const cached = await this.getSchemaWithCAS(workspaceId);
    if (cached) {
      return { schema: cached.schema, hash: cached.hash };
    }

    const schema = await this.generateSchema(workspaceId, context);
    const hash = await this.cacheSchemaWithCAS(workspaceId, schema);
    return { schema, hash };
  }


  private async detectWorkspaceState(
    workspaceId: string,
    context: WorkspaceContext
  ) {
    return this.workspaceDataLoader.detectWorkspaceState(workspaceId, context);
  }

  private async fetchWorkspaceData(state: import("../../types/sdui-integration").WorkspaceState) {
    const stage = state.lifecycleStage ?? state.lifecycle_stage;
    if (stage === "integrity") {
      const baseData = await this.workspaceDataLoader.fetchWorkspaceData({
        ...state,
        lifecycleStage: "opportunity",
        lifecycle_stage: "opportunity",
      } as import("../../types/sdui-integration").WorkspaceState);
      return {
        ...baseData,
        manifestoResults: await this.fetchManifestoResults(state.workspaceId ?? state.workspace_id),
      };
    }

    if (stage === "expansion") {
      const data = await this.workspaceDataLoader.fetchWorkspaceData(state);
      return {
        ...data,
        roi: await this.fetchROI(state.workspaceId ?? state.workspace_id),
      };
    }

    return this.workspaceDataLoader.fetchWorkspaceData(state);
  }

  private async fetchManifestoResults(workspaceId: string) {
    return (this.workspaceDataLoader as unknown as {
      fetchManifestoResults: (workspaceId: string) => Promise<unknown>;
    }).fetchManifestoResults(workspaceId);
  }

  private async fetchROI(workspaceId: string) {
    return (this.workspaceDataLoader as unknown as {
      fetchROI: (workspaceId: string) => Promise<unknown>;
    }).fetchROI(workspaceId);
  }

  private async applyAtomicActions(
    schema: SDUIPageDefinition,
    actions: AtomicUIAction[]
  ): Promise<SDUIPageDefinition> {
    return applyAtomicActions(schema, actions);
  }

  private findComponentIndices(
    schema: SDUIPageDefinition,
    selector: ComponentSelector
  ): number[] {
    return findComponentIndices(schema, selector);
  }
}

export const canvasSchemaService = new CanvasSchemaService();
