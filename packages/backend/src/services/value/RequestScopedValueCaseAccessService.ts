import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

interface RequestAccessContext {
  caseId: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  route?: string;
}

export class RequestScopedValueCaseAccessService {
  constructor(private readonly supabase: SupabaseClient) {}

  async assertCaseReadable({ caseId, tenantId, userId, requestId, route }: RequestAccessContext) {
    const { data, error } = await this.supabase
      .from("value_cases")
      .select("id, status")
      .eq("id", caseId)
      .maybeSingle();

    if (error) {
      logger.error("request-scoped case access lookup failed", {
        caseId,
        tenantId,
        userId,
        requestId,
        route,
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    if (!data) {
      logger.warn("request-scoped case access denied by RLS", {
        caseId,
        tenantId,
        userId,
        requestId,
        route,
      });
      return null;
    }

    return data;
  }
}
