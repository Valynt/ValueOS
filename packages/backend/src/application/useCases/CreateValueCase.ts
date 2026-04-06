/**
 * CreateValueCase — Application Use Case
 *
 * Orchestrates the creation of a new Value Case.
 * Routes call this use case; they do NOT directly access repositories or services.
 *
 * Responsibilities:
 *   1. Validate input (domain-level, not HTTP-level)
 *   2. Create the value case via the domain repository
 *   3. Emit an audit log entry
 *   4. Return the created case
 *
 * This use case intentionally has no knowledge of Express, HTTP status codes,
 * or request/response objects. It is pure application orchestration.
 */

import { z } from 'zod';
import { createLogger } from '../../lib/logger.js';
import { auditLogService } from '../../services/security/AuditLogService.js';
import type { UseCase, RequestContext, UseCaseResult } from '../types.js';

const logger = createLogger({ component: 'CreateValueCase' });

// ============================================================================
// Input / Output schemas
// ============================================================================

export const CreateValueCaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional(),
  domainPackId: z.string().uuid().optional(),
  domainPackVersion: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateValueCaseInput = z.infer<typeof CreateValueCaseInputSchema>;

export interface CreatedValueCase {
  id: string;
  name: string;
  company: string;
  description?: string;
  status: string;
  phase: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Repository interface (port) — injected, not imported directly
// ============================================================================

export interface ValueCaseRepository {
  create(
    tenantId: string,
    userId: string,
    input: {
      name: string;
      company: string;
      description?: string;
      website?: string;
      domain_pack_id?: string;
      domain_pack_version?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CreatedValueCase>;
}

// ============================================================================
// Use Case Implementation
// ============================================================================

export class CreateValueCase implements UseCase<CreateValueCaseInput, UseCaseResult<CreatedValueCase>> {
  constructor(private readonly repository: ValueCaseRepository) {}

  async execute(
    input: CreateValueCaseInput,
    context: RequestContext
  ): Promise<UseCaseResult<CreatedValueCase>> {
    const startMs = Date.now();

    logger.info('CreateValueCase: executing', {
      organizationId: context.organizationId,
      userId: context.userId,
      company: input.company,
      traceId: context.traceId,
    });

    // Validate input at the domain level
    const parsed = CreateValueCaseInputSchema.safeParse(input);
    if (!parsed.success) {
      throw Object.assign(new Error('Invalid CreateValueCase input'), {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    // Delegate to domain repository
    const valueCase = await this.repository.create(
      context.organizationId,
      context.userId,
      {
        name: parsed.data.name,
        company: parsed.data.company,
        description: parsed.data.description,
        website: parsed.data.website,
        domain_pack_id: parsed.data.domainPackId,
        domain_pack_version: parsed.data.domainPackVersion,
        metadata: parsed.data.metadata,
      }
    );

    // Emit audit log
    await auditLogService.logAudit({
      action: 'value_case.created',
      actorId: context.userId,
      tenantId: context.organizationId,
      resourceType: 'value_case',
      resourceId: valueCase.id,
      metadata: {
        company: input.company,
        traceId: context.traceId,
      },
    }).catch((err) => {
      // Audit log failures must not block the primary operation
      logger.error('CreateValueCase: audit log failed', { err, traceId: context.traceId });
    });

    const durationMs = Date.now() - startMs;
    logger.info('CreateValueCase: complete', {
      valueCaseId: valueCase.id,
      durationMs,
      traceId: context.traceId,
    });

    return {
      data: valueCase,
      meta: { traceId: context.traceId, durationMs },
    };
  }
}
