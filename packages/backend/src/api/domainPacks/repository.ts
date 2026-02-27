/**
 * Domain Packs Repository
 *
 * Supabase-backed data access for domain packs.
 * All queries enforce tenant isolation: own packs + global packs (tenant_id IS NULL).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateDomainPackRequest,
  DomainPack,
  DomainPackAssumption,
  DomainPackKpi,
  ListDomainPacksQuery,
  PaginatedResponse,
  UpdateDomainPackRequest,
} from './types.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Repository Errors
// ============================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND');
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
  }
}

export class NotImplementedError extends RepositoryError {
  constructor(method: string) {
    super(`${method} is not yet implemented`, 'NOT_IMPLEMENTED');
  }
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface DomainPacksRepositoryInterface {
  /** Create a new domain pack (always starts as draft). */
  create(tenantId: string, input: CreateDomainPackRequest): Promise<DomainPack>;

  /** Update a draft pack. Active/deprecated packs cannot be edited. */
  update(tenantId: string, id: string, patch: UpdateDomainPackRequest): Promise<DomainPack>;

  /** Get a single pack by ID. Includes global packs (tenant_id IS NULL). */
  getById(tenantId: string, id: string): Promise<DomainPack>;

  /** List packs visible to the tenant (own + global). */
  list(tenantId: string, query: ListDomainPacksQuery): Promise<PaginatedResponse<DomainPack>>;

  /** Transition a draft pack to active. Runs publish validation. */
  publish(tenantId: string, id: string): Promise<DomainPack>;

  /** Soft-delete: transition to deprecated. */
  deprecate(tenantId: string, id: string): Promise<DomainPack>;
}

// ============================================================================
// DB Row Types
// ============================================================================

interface PackRow {
  id: string;
  tenant_id: string | null;
  name: string;
  industry: string;
  version: string;
  status: string;
  parent_pack_id: string | null;
  created_at: string;
  updated_at: string;
}

interface KpiRow {
  kpi_key: string;
  default_name: string;
  description: string | null;
  unit: string | null;
  direction: string | null;
  baseline_hint: string | null;
  target_hint: string | null;
  default_confidence: number;
  sort_order: number;
  tags: string[] | null;
}

interface AssumptionRow {
  assumption_key: string;
  value_type: string;
  value_number: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  value_json: Record<string, unknown> | null;
  unit: string | null;
  default_confidence: number;
  rationale: string | null;
  evidence_refs: Record<string, unknown>[];
}

// ============================================================================
// Mappers
// ============================================================================

function mapKpiRow(row: KpiRow): DomainPackKpi {
  return {
    kpiKey: row.kpi_key,
    defaultName: row.default_name,
    description: row.description ?? undefined,
    unit: row.unit ?? undefined,
    direction: row.direction as DomainPackKpi['direction'],
    baselineHint: row.baseline_hint ?? undefined,
    targetHint: row.target_hint ?? undefined,
    defaultConfidence: row.default_confidence,
    sortOrder: row.sort_order,
    tags: row.tags ?? undefined,
  };
}

function mapAssumptionRow(row: AssumptionRow): DomainPackAssumption {
  return {
    assumptionKey: row.assumption_key,
    valueType: row.value_type as DomainPackAssumption['valueType'],
    valueNumber: row.value_number ?? undefined,
    valueText: row.value_text ?? undefined,
    valueBool: row.value_bool ?? undefined,
    valueJson: row.value_json ?? undefined,
    unit: row.unit ?? undefined,
    defaultConfidence: row.default_confidence,
    rationale: row.rationale ?? undefined,
    evidenceRefs: row.evidence_refs ?? [],
  };
}

function mapPackRow(row: PackRow, kpis: DomainPackKpi[], assumptions: DomainPackAssumption[]): DomainPack {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    industry: row.industry,
    version: row.version,
    status: row.status as DomainPack['status'],
    parentPackId: row.parent_pack_id,
    kpis,
    assumptions,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// Supabase Implementation
// ============================================================================

export class DomainPacksRepository implements DomainPacksRepositoryInterface {
  constructor(private supabase: SupabaseClient) {}

  async create(tenantId: string, input: CreateDomainPackRequest): Promise<DomainPack> {
    const { data: packRow, error: packError } = await this.supabase
      .from('domain_packs')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        industry: input.industry,
        version: input.version ?? '1.0.0',
        status: 'draft',
        parent_pack_id: input.parentPackId ?? null,
      })
      .select('*')
      .single();

    if (packError || !packRow) {
      throw new DatabaseError(`Failed to create domain pack: ${packError?.message ?? 'no data'}`);
    }

    const packId = (packRow as PackRow).id;

    let kpis: DomainPackKpi[] = [];
    if (input.kpis && input.kpis.length > 0) {
      const kpiRows = input.kpis.map((k, i) => ({
        domain_pack_id: packId,
        kpi_key: k.kpiKey,
        default_name: k.defaultName,
        description: k.description ?? null,
        unit: k.unit ?? null,
        direction: k.direction ?? null,
        baseline_hint: k.baselineHint ?? null,
        target_hint: k.targetHint ?? null,
        default_confidence: k.defaultConfidence ?? 0.8,
        sort_order: k.sortOrder ?? i,
        tags: k.tags ?? null,
      }));

      const { error: kpiError } = await this.supabase
        .from('domain_pack_kpis')
        .insert(kpiRows);

      if (kpiError) {
        logger.error('Failed to insert KPIs for domain pack', { packId, error: kpiError.message });
      }
      kpis = input.kpis;
    }

    let assumptions: DomainPackAssumption[] = [];
    if (input.assumptions && input.assumptions.length > 0) {
      const assumptionRows = input.assumptions.map((a) => ({
        domain_pack_id: packId,
        assumption_key: a.assumptionKey,
        value_type: a.valueType,
        value_number: a.valueNumber ?? null,
        value_text: a.valueText ?? null,
        value_bool: a.valueBool ?? null,
        value_json: a.valueJson ?? null,
        unit: a.unit ?? null,
        default_confidence: a.defaultConfidence ?? 0.9,
        rationale: a.rationale ?? null,
        evidence_refs: a.evidenceRefs ?? [],
      }));

      const { error: assError } = await this.supabase
        .from('domain_pack_assumptions')
        .insert(assumptionRows);

      if (assError) {
        logger.error('Failed to insert assumptions for domain pack', { packId, error: assError.message });
      }
      assumptions = input.assumptions;
    }

    return mapPackRow(packRow as PackRow, kpis, assumptions);
  }

  async update(tenantId: string, id: string, patch: UpdateDomainPackRequest): Promise<DomainPack> {
    const existing = await this.getById(tenantId, id);
    if (existing.status !== 'draft') {
      throw new ConflictError(`Cannot update pack in "${existing.status}" status. Only draft packs are editable.`);
    }

    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.industry !== undefined) updates.industry = patch.industry;
    if (patch.version !== undefined) updates.version = patch.version;
    if (patch.metadata !== undefined) updates.metadata = patch.metadata;

    if (Object.keys(updates).length > 0) {
      const { error } = await this.supabase
        .from('domain_packs')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new DatabaseError(`Failed to update domain pack: ${error.message}`);
      }
    }

    // Replace KPIs if provided
    if (patch.kpis !== undefined) {
      await this.supabase.from('domain_pack_kpis').delete().eq('domain_pack_id', id);

      if (patch.kpis.length > 0) {
        const kpiRows = patch.kpis.map((k, i) => ({
          domain_pack_id: id,
          kpi_key: k.kpiKey,
          default_name: k.defaultName,
          description: k.description ?? null,
          unit: k.unit ?? null,
          direction: k.direction ?? null,
          baseline_hint: k.baselineHint ?? null,
          target_hint: k.targetHint ?? null,
          default_confidence: k.defaultConfidence ?? 0.8,
          sort_order: k.sortOrder ?? i,
          tags: k.tags ?? null,
        }));

        const { error } = await this.supabase.from('domain_pack_kpis').insert(kpiRows);
        if (error) throw new DatabaseError(`Failed to update KPIs: ${error.message}`);
      }
    }

    // Replace assumptions if provided
    if (patch.assumptions !== undefined) {
      await this.supabase.from('domain_pack_assumptions').delete().eq('domain_pack_id', id);

      if (patch.assumptions.length > 0) {
        const rows = patch.assumptions.map((a) => ({
          domain_pack_id: id,
          assumption_key: a.assumptionKey,
          value_type: a.valueType,
          value_number: a.valueNumber ?? null,
          value_text: a.valueText ?? null,
          value_bool: a.valueBool ?? null,
          value_json: a.valueJson ?? null,
          unit: a.unit ?? null,
          default_confidence: a.defaultConfidence ?? 0.9,
          rationale: a.rationale ?? null,
          evidence_refs: a.evidenceRefs ?? [],
        }));

        const { error } = await this.supabase.from('domain_pack_assumptions').insert(rows);
        if (error) throw new DatabaseError(`Failed to update assumptions: ${error.message}`);
      }
    }

    return this.getById(tenantId, id);
  }

  async getById(tenantId: string, id: string): Promise<DomainPack> {
    const { data: packRow, error: packError } = await this.supabase
      .from('domain_packs')
      .select('*')
      .eq('id', id)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .single();

    if (packError || !packRow) {
      throw new NotFoundError('DomainPack', id);
    }

    const [kpisResult, assumptionsResult] = await Promise.all([
      this.supabase
        .from('domain_pack_kpis')
        .select('*')
        .eq('domain_pack_id', id)
        .order('sort_order'),
      this.supabase
        .from('domain_pack_assumptions')
        .select('*')
        .eq('domain_pack_id', id),
    ]);

    const kpis = (kpisResult.data ?? []).map((r) => mapKpiRow(r as KpiRow));
    const assumptions = (assumptionsResult.data ?? []).map((r) => mapAssumptionRow(r as AssumptionRow));

    return mapPackRow(packRow as PackRow, kpis, assumptions);
  }

  async list(tenantId: string, query: ListDomainPacksQuery): Promise<PaginatedResponse<DomainPack>> {
    const { page, limit, sortBy, sortOrder, status, industry, search } = query;
    const offset = (page - 1) * limit;

    let countQuery = this.supabase
      .from('domain_packs')
      .select('id', { count: 'exact', head: true })
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

    if (status) countQuery = countQuery.eq('status', status);
    if (industry) countQuery = countQuery.eq('industry', industry);
    if (search) countQuery = countQuery.ilike('name', `%${search}%`);

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw new DatabaseError(`Failed to count domain packs: ${countError.message}`);
    }

    const total = count ?? 0;

    let dataQuery = this.supabase
      .from('domain_packs')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (status) dataQuery = dataQuery.eq('status', status);
    if (industry) dataQuery = dataQuery.eq('industry', industry);
    if (search) dataQuery = dataQuery.ilike('name', `%${search}%`);

    const { data: rows, error: dataError } = await dataQuery;
    if (dataError) {
      throw new DatabaseError(`Failed to list domain packs: ${dataError.message}`);
    }

    // List returns packs without child KPIs/assumptions for performance
    const packs = (rows ?? []).map((r) => mapPackRow(r as PackRow, [], []));

    return {
      data: packs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    };
  }

  async publish(tenantId: string, id: string): Promise<DomainPack> {
    const pack = await this.getById(tenantId, id);

    if (pack.status !== 'draft') {
      throw new ConflictError(`Only draft packs can be published. Current status: ${pack.status}`);
    }

    if (pack.kpis.length === 0) {
      throw new ConflictError('Cannot publish a pack with no KPIs');
    }

    const { error } = await this.supabase
      .from('domain_packs')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new DatabaseError(`Failed to publish domain pack: ${error.message}`);
    }

    return this.getById(tenantId, id);
  }

  async deprecate(tenantId: string, id: string): Promise<DomainPack> {
    const pack = await this.getById(tenantId, id);

    if (pack.status === 'deprecated') {
      throw new ConflictError('Pack is already deprecated');
    }

    const { error } = await this.supabase
      .from('domain_packs')
      .update({ status: 'deprecated' })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new DatabaseError(`Failed to deprecate domain pack: ${error.message}`);
    }

    return this.getById(tenantId, id);
  }
}

// ============================================================================
// Factory
// ============================================================================

let repository: DomainPacksRepository | null = null;

export function getDomainPacksRepository(supabase?: SupabaseClient): DomainPacksRepository {
  if (supabase) {
    repository = new DomainPacksRepository(supabase);
  }
  if (!repository) {
    throw new Error('DomainPacksRepository not initialized. Call getDomainPacksRepository(supabase) first.');
  }
  return repository;
}
