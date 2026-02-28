export * from "./types.js"

export { MemoryService, MemoryServiceError } from "./MemoryService.js"
export {
  MemoryPipeline,
  ChunkerFactory,
  ExtractionService,
  generateContentHash,
  withRetries,
} from "./MemoryPipeline";
export { RetrievalEngine } from "./RetrievalEngine.js"
export { ModelRunEngine, DefaultBenchmarkProvider } from "./ModelRunEngine.js"
export type { BenchmarkProvider } from "./ModelRunEngine.js"
export { NarrativeEngine } from "./NarrativeEngine.js"
export { ApprovalService, ApprovalError } from "./ApprovalService.js"
export { AccessService } from "./AccessService.js"
export {
  MemoryBenchmarkService,
  NotFoundError,
  VersionConflictError,
} from "./MemoryBenchmarkService";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { AccessService } from "./AccessService.js"
import { ApprovalService } from "./ApprovalService.js"
import { MemoryBenchmarkService } from "./MemoryBenchmarkService.js"
import { MemoryPipeline } from "./MemoryPipeline.js"
import { MemoryService } from "./MemoryService.js"
import { DefaultBenchmarkProvider, ModelRunEngine } from "./ModelRunEngine.js"
import { NarrativeEngine } from "./NarrativeEngine.js"
import { RetrievalEngine } from "./RetrievalEngine.js"
import { UUID } from "./types.js"

export interface MemoryLayerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tenantId: UUID;
  togetherApiKey?: string;
}

export interface MemoryLayer {
  memoryService: MemoryService;
  pipeline: MemoryPipeline;
  retrieval: RetrievalEngine;
  modelRun: ModelRunEngine;
  narrative: NarrativeEngine;
  approval: ApprovalService;
  access: AccessService;
  benchmark: MemoryBenchmarkService;
  client: SupabaseClient;
}

export function createMemoryLayer(config: MemoryLayerConfig): MemoryLayer {
  const client = createClient(config.supabaseUrl, config.supabaseKey);

  const memoryService = new MemoryService(
    config.supabaseUrl,
    config.supabaseKey,
    config.tenantId
  );

  const pipeline = new MemoryPipeline(
    config.supabaseUrl,
    config.supabaseKey,
    config.togetherApiKey || ""
  );

  const retrieval = new RetrievalEngine(client);

  const benchmarkProvider = new DefaultBenchmarkProvider(client);
  const modelRun = new ModelRunEngine(client, benchmarkProvider);

  const narrative = new NarrativeEngine(memoryService, modelRun, client);

  const approval = new ApprovalService(client, config.tenantId);

  const access = new AccessService(client);

  const benchmark = new MemoryBenchmarkService(client);

  return {
    memoryService,
    pipeline,
    retrieval,
    modelRun,
    narrative,
    approval,
    access,
    benchmark,
    client,
  };
}
