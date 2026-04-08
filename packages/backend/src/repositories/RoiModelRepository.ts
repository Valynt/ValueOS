/**
 * Repository Implementation
 *
 * Accepts an RLS-scoped SupabaseClient — never creates its own service-role
 * client.  All queries MUST include an organization_id filter.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger.js";

export class RoiModelRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly organizationId: string
  ) {
    if (!organizationId) {
      throw new Error(
        "RoiModelRepository requires organizationId for tenant isolation"
      );
    }
  }

  async findById(id: string): Promise<unknown> {
    logger.debug("RoiModelRepository findById", {
      id,
      organizationId: this.organizationId,
    });
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    logger.debug("RoiModelRepository create", {
      data,
      organizationId: this.organizationId,
    });
    return data;
  }
}
