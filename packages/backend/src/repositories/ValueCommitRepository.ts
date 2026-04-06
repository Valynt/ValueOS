/**
 * Repository Implementation
 *
 * Accepts an RLS-scoped SupabaseClient — never creates its own service-role
 * client.  All queries MUST include an organization_id filter.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger.js";

export class ValueCommitRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly organizationId: string
  ) {
    if (!organizationId) {
      throw new Error(
        "ValueCommitRepository requires organizationId for tenant isolation"
      );
    }
  }

  async findById(id: string): Promise<unknown> {
    logger.debug("ValueCommitRepository findById", {
      id,
      organizationId: this.organizationId,
    });
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    logger.debug("ValueCommitRepository create", {
      data,
      organizationId: this.organizationId,
    });
    return data;
  }
}
