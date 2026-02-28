/**
 * Audit logging stub for SDUI package.
 * Delegates to structured logger until a shared audit service is available.
 */

import { logger } from "@shared/lib/logger";

export interface AuditActor {
  type: "human" | "agent" | "system";
  id: string;
  role: string;
  organizationId: string;
  sessionId?: string;
}

export const enhancedAuditLogger = {
  async logDataAccess(
    actor: AuditActor,
    source: string,
    binding: string,
    operation: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.info("Audit: data access", {
      actorId: actor.id,
      actorType: actor.type,
      organizationId: actor.organizationId,
      source,
      binding,
      operation,
      success,
      ...metadata,
    });
  },
};
