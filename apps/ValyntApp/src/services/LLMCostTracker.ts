import { logger } from "../lib/logger";
import { getLLMCostTrackerConfig } from "@valueos/shared/lib/env";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface LLMUsageRecord {
  tenant_id: string;
  user_id: string;
  session_id?: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  endpoint: string;
  success: boolean;
  error_message?: string;
  latency_ms: number;
  created_at: string;
}

class LLMCostTracker {
  private supabase?: SupabaseClient;
  private tableName: string;

  constructor() {
    const { supabaseUrl, supabaseKey, tableName } = getLLMCostTrackerConfig();
    this.tableName = tableName || "llm_usage";

    if (!supabaseUrl || !supabaseKey) {
      logger.warn("LLMCostTracker disabled: missing Supabase configuration");
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async trackUsage(params: {
    tenantId: string;
    userId: string;
    sessionId?: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    endpoint: string;
    success: boolean;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    if (!this.supabase) return;

    const record: LLMUsageRecord = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      session_id: params.sessionId,
      provider: params.provider,
      model: params.model,
      input_tokens: params.promptTokens,
      output_tokens: params.completionTokens,
      total_tokens: params.promptTokens + params.completionTokens,
      endpoint: params.endpoint,
      success: params.success,
      error_message: params.errorMessage,
      latency_ms: params.latencyMs,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await this.supabase.from(this.tableName).insert(record);
      if (error) {
        logger.error("Failed to track LLM usage:", error);
      }
    } catch (error) {
      logger.error("Unexpected error tracking LLM usage:", error);
    }
  }
}

export const llmCostTracker = new LLMCostTracker();
