/**
 * Enterprise adapter interface - pure contract
 *
 * Rules:
 * - No implementation
 * - No SDK imports
 * - No environment access
 */

import type {
  IntegrationCapabilities,
  IntegrationConfig,
  IntegrationCredentials,
  NormalizedEntity,
  SyncResult,
} from "./types.js";

export interface IEnterpriseAdapter {
  readonly provider: string;
  readonly capabilities: IntegrationCapabilities;

  connect(credentials: IntegrationCredentials): Promise<void>;

  disconnect(): Promise<void>;

  validate(): Promise<boolean>;

  fetchEntities(
    entityType: string,
    options?: FetchOptions
  ): Promise<NormalizedEntity[]>;

  fetchEntity(
    entityType: string,
    externalId: string
  ): Promise<NormalizedEntity | null>;

  pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<void>;

  sync(entityTypes: string[]): Promise<SyncResult>;
}

export interface FetchOptions {
  limit?: number;
  offset?: number;
  since?: Date;
  filters?: Record<string, unknown>;
}

export interface AdapterFactory {
  create(config: IntegrationConfig): IEnterpriseAdapter;
}
