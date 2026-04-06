/**
 * Context Normalization Pipeline (Sprint 6 — Ingestion Layer)
 *
 * Normalizes inputs from multiple sources — documents, web scrapes, and CRM
 * records — into a unified NormalizedContext that agents can consume without
 * knowing the origin format.
 *
 * Design principles:
 * - Tenant-scoped: every NormalizedContext carries organizationId
 * - Source-transparent: agents receive a single NormalizedContext regardless
 *   of whether the data came from a PDF, a URL, or a CRM deal
 * - Additive: multiple sources can be merged into one context
 * - Auditable: provenance is tracked per field
 */

import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import type { ExtractedInsights, ParsedDocument } from '../domain-packs/DocumentParserService.js';
import type { WebScraperResult } from '../post-v1/WebScraperService.js';
import type { MappedValueCase, MappedStakeholder } from '../core/CRMFieldMapper.js';

// ============================================================================
// Types
// ============================================================================

export type ContextSourceType = 'document' | 'web' | 'crm' | 'manual';

export interface ContextSource {
  type: ContextSourceType;
  /** Human-readable identifier: file name, URL, CRM deal ID, etc. */
  identifier: string;
  /** ISO timestamp of when this source was ingested */
  ingestedAt: string;
}

export interface NormalizedStakeholder {
  name: string;
  email?: string;
  title?: string;
  role?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  isPrimary?: boolean;
  /** Which source this stakeholder was extracted from */
  source: ContextSourceType;
}

export interface NormalizedContext {
  /** Tenant scope — required for all downstream consumers */
  organizationId: string;
  /** Optional value case this context is being prepared for */
  valueCaseId?: string;

  // ---- Company / Deal ----
  companyName?: string;
  industry?: string;
  dealSize?: string;
  timeline?: string;

  // ---- Discovery inputs ----
  painPoints: string[];
  opportunities: string[];
  competitors: string[];
  nextSteps: string[];

  // ---- Stakeholders ----
  stakeholders: NormalizedStakeholder[];

  // ---- Free-text content ----
  /** Combined summary from all sources */
  summary: string;
  /** Raw text content (e.g. from documents or web pages) */
  rawContent?: string;

  // ---- Provenance ----
  sources: ContextSource[];
  /** ISO timestamp of when this context was assembled */
  assembledAt: string;
}

// ============================================================================
// Zod schema for NormalizedContext validation
// ============================================================================

export const NormalizedStakeholderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  title: z.string().optional(),
  role: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  isPrimary: z.boolean().optional(),
  source: z.enum(['document', 'web', 'crm', 'manual']),
});

export const NormalizedContextSchema = z.object({
  organizationId: z.string().uuid(),
  valueCaseId: z.string().uuid().optional(),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  dealSize: z.string().optional(),
  timeline: z.string().optional(),
  painPoints: z.array(z.string()),
  opportunities: z.array(z.string()),
  competitors: z.array(z.string()),
  nextSteps: z.array(z.string()),
  stakeholders: z.array(NormalizedStakeholderSchema),
  summary: z.string(),
  rawContent: z.string().optional(),
  sources: z.array(
    z.object({
      type: z.enum(['document', 'web', 'crm', 'manual']),
      identifier: z.string(),
      ingestedAt: z.string(),
    }),
  ),
  assembledAt: z.string(),
});

// ============================================================================
// Pipeline
// ============================================================================

export class ContextNormalizationPipeline {
  private readonly organizationId: string;
  private readonly valueCaseId?: string;

  // Accumulated state
  private companyName?: string;
  private industry?: string;
  private dealSize?: string;
  private timeline?: string;
  private readonly painPoints = new Set<string>();
  private readonly opportunities = new Set<string>();
  private readonly competitors = new Set<string>();
  private readonly nextSteps = new Set<string>();
  private readonly stakeholders: NormalizedStakeholder[] = [];
  private readonly summaryParts: string[] = [];
  private rawContent?: string;
  private readonly sources: ContextSource[] = [];

  constructor(params: { organizationId: string; valueCaseId?: string }) {
    this.organizationId = params.organizationId;
    this.valueCaseId = params.valueCaseId;
  }

  // --------------------------------------------------------------------------
  // Source adapters
  // --------------------------------------------------------------------------

  /**
   * Ingest a parsed document and its extracted insights.
   */
  addDocument(
    document: ParsedDocument,
    insights: ExtractedInsights,
    fileName: string,
  ): this {
    const source: ContextSource = {
      type: 'document',
      identifier: fileName,
      ingestedAt: new Date().toISOString(),
    };
    this.sources.push(source);

    this.mergeScalar('companyName', insights.companyName);
    this.mergeScalar('industry', insights.industry);
    this.mergeScalar('dealSize', insights.dealSize);
    this.mergeScalar('timeline', insights.timeline);

    insights.painPoints.forEach((p) => this.painPoints.add(p));
    insights.opportunities.forEach((o) => this.opportunities.add(o));
    insights.nextSteps.forEach((n) => this.nextSteps.add(n));
    (insights.competitors ?? []).forEach((c) => this.competitors.add(c));

    for (const s of insights.stakeholders) {
      this.mergeStakeholder({
        name: s.name,
        role: s.role,
        sentiment: s.sentiment as NormalizedStakeholder['sentiment'],
        source: 'document',
      });
    }

    if (insights.summary) {
      this.summaryParts.push(insights.summary);
    }

    // Keep raw content for agents that need full text
    if (document.text) {
      this.rawContent = this.rawContent
        ? `${this.rawContent}\n\n---\n\n${document.text}`
        : document.text;
    }

    logger.debug('ContextNormalizationPipeline: document ingested', {
      organizationId: this.organizationId,
      fileName,
      painPoints: insights.painPoints.length,
      stakeholders: insights.stakeholders.length,
    });

    return this;
  }

  /**
   * Ingest a web scrape result.
   */
  addWebScrape(result: WebScraperResult, url: string): this {
    const source: ContextSource = {
      type: 'web',
      identifier: url,
      ingestedAt: new Date().toISOString(),
    };
    this.sources.push(source);

    if (result.title) {
      this.summaryParts.push(result.title);
    }
    if (result.description) {
      this.summaryParts.push(result.description);
    }
    if (result.content) {
      this.rawContent = this.rawContent
        ? `${this.rawContent}\n\n---\n\n${result.content}`
        : result.content;
    }

    logger.debug('ContextNormalizationPipeline: web scrape ingested', {
      organizationId: this.organizationId,
      url,
      contentLength: result.content?.length ?? 0,
    });

    return this;
  }

  /**
   * Ingest a CRM deal record.
   */
  addCRMRecord(deal: MappedValueCase, stakeholders: MappedStakeholder[] = []): this {
    const source: ContextSource = {
      type: 'crm',
      identifier: deal.metadata.crmDealId,
      ingestedAt: new Date().toISOString(),
    };
    this.sources.push(source);

    this.mergeScalar('companyName', deal.company);
    this.mergeScalar('dealSize', deal.metadata.dealValue?.toString());
    this.mergeScalar('timeline', deal.metadata.closeDate);

    const allStakeholders = [
      ...(deal.metadata.stakeholders ?? []),
      ...stakeholders,
    ];
    for (const s of allStakeholders) {
      this.mergeStakeholder({
        name: s.name,
        email: s.email,
        title: s.title,
        role: s.role,
        isPrimary: s.isPrimary,
        source: 'crm',
      });
    }

    logger.debug('ContextNormalizationPipeline: CRM record ingested', {
      organizationId: this.organizationId,
      crmDealId: deal.metadata.crmDealId,
      company: deal.company,
    });

    return this;
  }

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------

  /**
   * Assemble and validate the final NormalizedContext.
   *
   * @throws {z.ZodError} if the assembled context fails schema validation.
   */
  build(): NormalizedContext {
    const context: NormalizedContext = {
      organizationId: this.organizationId,
      valueCaseId: this.valueCaseId,
      companyName: this.companyName,
      industry: this.industry,
      dealSize: this.dealSize,
      timeline: this.timeline,
      painPoints: Array.from(this.painPoints),
      opportunities: Array.from(this.opportunities),
      competitors: Array.from(this.competitors),
      nextSteps: Array.from(this.nextSteps),
      stakeholders: this.deduplicateStakeholders(),
      summary: this.summaryParts.join(' ').trim(),
      rawContent: this.rawContent,
      sources: this.sources,
      assembledAt: new Date().toISOString(),
    };

    // Validate before returning — fail fast if the contract is violated
    NormalizedContextSchema.parse(context);

    logger.info('ContextNormalizationPipeline: context assembled', {
      organizationId: this.organizationId,
      valueCaseId: this.valueCaseId,
      sources: this.sources.length,
      painPoints: context.painPoints.length,
      stakeholders: context.stakeholders.length,
    });

    return context;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Set a scalar field only if it has not already been set (first-write wins).
   * CRM data is authoritative for company name and deal metadata; documents
   * and web scrapes fill in gaps.
   */
  private mergeScalar(
    field: 'companyName' | 'industry' | 'dealSize' | 'timeline',
    value: string | undefined,
  ): void {
    if (value && !this[field]) {
      this[field] = value;
    }
  }

  /**
   * Merge a stakeholder, deduplicating by name (case-insensitive).
   * CRM records are authoritative for contact details; document/web records
   * fill in sentiment and role where missing.
   */
  private mergeStakeholder(incoming: NormalizedStakeholder): void {
    const existing = this.stakeholders.find(
      (s) => s.name.toLowerCase() === incoming.name.toLowerCase(),
    );
    if (existing) {
      // Enrich existing record with any new fields
      existing.email ??= incoming.email;
      existing.title ??= incoming.title;
      existing.role ??= incoming.role;
      existing.sentiment ??= incoming.sentiment;
      existing.isPrimary ??= incoming.isPrimary;
    } else {
      this.stakeholders.push({ ...incoming });
    }
  }

  /**
   * Remove duplicate stakeholders that may have been added via mergeStakeholder
   * race conditions (shouldn't happen in single-threaded JS, but defensive).
   */
  private deduplicateStakeholders(): NormalizedStakeholder[] {
    const seen = new Set<string>();
    return this.stakeholders.filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ============================================================================
// Factory helper
// ============================================================================

/**
 * Create a new ContextNormalizationPipeline for a given tenant scope.
 */
export function createContextPipeline(params: {
  organizationId: string;
  valueCaseId?: string;
}): ContextNormalizationPipeline {
  return new ContextNormalizationPipeline(params);
}
