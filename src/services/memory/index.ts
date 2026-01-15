export * from "./types";

export { MemoryService, MemoryServiceError } from "./MemoryService";
export {
  MemoryPipeline,
  ChunkerFactory,
  ExtractionService,
  generateContentHash,
  withRetries,
} from "./MemoryPipeline";
export { RetrievalEngine } from "./RetrievalEngine";
export { ModelRunEngine, DefaultBenchmarkProvider } from "./ModelRunEngine";
export type { BenchmarkProvider } from "./ModelRunEngine";
export { NarrativeEngine } from "./NarrativeEngine";
export { ApprovalService, ApprovalError } from "./ApprovalService";
export { AccessService } from "./AccessService";
export {
  MemoryBenchmarkService,
  NotFoundError,
  VersionConflictError,
} from "./MemoryBenchmarkService";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MemoryService } from "./MemoryService";
import { MemoryPipeline } from "./MemoryPipeline";
import { RetrievalEngine } from "./RetrievalEngine";
import { ModelRunEngine, DefaultBenchmarkProvider } from "./ModelRunEngine";
import { NarrativeEngine } from "./NarrativeEngine";
import { ApprovalService } from "./ApprovalService";
import { AccessService } from "./AccessService";
import { MemoryBenchmarkService } from "./MemoryBenchmarkService";
import { UUID } from "./types";

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
