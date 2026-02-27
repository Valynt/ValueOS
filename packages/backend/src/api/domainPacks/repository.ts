/**
 * Domain Packs Repository
 *
 * Data access interface and skeleton for domain packs.
 * Methods throw NotImplementedError until Supabase wiring is added.
 */

import type {
  DomainPack,
  CreateDomainPackRequest,
  UpdateDomainPackRequest,
  ListDomainPacksQuery,
  PaginatedResponse,
} from './types.js';

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
// Skeleton Implementation
// ============================================================================

export class DomainPacksRepository implements DomainPacksRepositoryInterface {
  // TODO: inject SupabaseClient once DB layer is wired
  // private supabase: SupabaseClient;

  async create(_tenantId: string, _input: CreateDomainPackRequest): Promise<DomainPack> {
    throw new NotImplementedError('DomainPacksRepository.create');
  }

  async update(
    _tenantId: string,
    _id: string,
    _patch: UpdateDomainPackRequest,
  ): Promise<DomainPack> {
    throw new NotImplementedError('DomainPacksRepository.update');
  }

  async getById(_tenantId: string, _id: string): Promise<DomainPack> {
    throw new NotImplementedError('DomainPacksRepository.getById');
  }

  async list(
    _tenantId: string,
    _query: ListDomainPacksQuery,
  ): Promise<PaginatedResponse<DomainPack>> {
    throw new NotImplementedError('DomainPacksRepository.list');
  }

  async publish(_tenantId: string, _id: string): Promise<DomainPack> {
    throw new NotImplementedError('DomainPacksRepository.publish');
  }

  async deprecate(_tenantId: string, _id: string): Promise<DomainPack> {
    throw new NotImplementedError('DomainPacksRepository.deprecate');
  }
}

// ============================================================================
// Singleton
// ============================================================================

let repository: DomainPacksRepository | null = null;

export function getDomainPacksRepository(): DomainPacksRepository {
  if (!repository) {
    repository = new DomainPacksRepository();
  }
  return repository;
}
