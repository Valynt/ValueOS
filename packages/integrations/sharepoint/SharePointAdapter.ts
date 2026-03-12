/**
 * SharePoint Adapter
 *
 * Implements the Microsoft Graph API for SharePoint site, list, and drive item access.
 * Uses OAuth2 bearer token (delegated or app-only).
 * All entities include tenant isolation via credentials.tenantId.
 *
 * Supported entity types: site, list, driveitem
 * pushUpdate updates a list item field set (entityType=list, externalId=itemId).
 */

import {
  AuthError,
  EnterpriseAdapter,
  IntegrationError,
  RateLimitError,
  RateLimiter,
  ValidationError,
} from "../base/index.js";
import type { FetchOptions, IntegrationConfig, NormalizedEntity } from "../base/index.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SharePointEntityType = "site" | "list" | "driveitem";

interface GraphSite {
  id: string;
  name?: string;
  displayName?: string;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  description?: string;
}

interface GraphList {
  id: string;
  name?: string;
  displayName?: string;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  list?: { template?: string };
}

interface GraphDriveItem {
  id: string;
  name?: string;
  webUrl?: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
}

interface GraphCollectionResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

interface GraphErrorResponse {
  error?: { code?: string; message?: string };
}

interface SharePointConfigCredentials {
  accessToken?: string;
  siteId?: string;
  driveId?: string;
}

interface SharePointAdapterConfig {
  baseUrl: string;
  authMode: "oauth2";
  timeoutMs: number;
  retryAttempts: number;
}

const graphSiteSchema = z.object({ id: z.string() }).passthrough();
const graphListSchema = z.object({ id: z.string() }).passthrough();
const graphDriveItemSchema = z.object({ id: z.string() }).passthrough();
const graphCollectionSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({ value: z.array(itemSchema), "@odata.nextLink": z.string().optional() });
const graphErrorSchema = z.object({ error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional() });

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SharePointAdapter extends EnterpriseAdapter {
  readonly provider = "sharepoint";

  private accessToken: string | null = null;
  private siteId: string | null = null;
  private driveId: string | null = null;
  private adapterConfig: SharePointAdapterConfig | null = null;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "sharepoint",
      requestsPerMinute: 120,
    }));
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  protected async doConnect(): Promise<void> {
    const configured = this.readConfiguredCredentials();
    this.adapterConfig = {
      baseUrl: this.config.baseUrl ?? GRAPH_API_BASE,
      authMode: "oauth2",
      timeoutMs: this.config.timeout ?? DEFAULT_TIMEOUT_MS,
      retryAttempts: this.config.retryAttempts ?? 1,
    };
    const token = this.credentials?.accessToken ?? configured.accessToken;
    if (!token) {
      throw new AuthError(this.provider, "SharePoint requires an OAuth2 access token in connect credentials or IntegrationConfig.credentials.");
    }
    this.accessToken = token;
    this.siteId = configured.siteId ?? null;
    this.driveId = configured.driveId ?? null;
  }

  protected async doDisconnect(): Promise<void> {
    this.accessToken = null;
    this.siteId = null;
    this.driveId = null;
    this.adapterConfig = null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  async validate(): Promise<boolean> {
    this.ensureConnected();
    try {
      // Lightweight call: fetch the root site to confirm token works
      await this.request("GET", "/sites/root", graphSiteSchema);
      return true;
    } catch (error) {
      if (error instanceof AuthError) return false;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // fetchEntities
  // -------------------------------------------------------------------------

  async fetchEntities(entityType: string, options?: FetchOptions): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    const type = this.validateEntityType(entityType);
    const tenantId = this.credentials?.tenantId;
    if (!tenantId) {
      throw new ValidationError(this.provider, "Missing tenantId in SharePoint credentials for rate limiting");
    }
    const top = options?.limit ?? 100;

    return this.withRateLimit(tenantId, async () => {
      switch (type) {
        case "site": {
          const response = await this.request("GET", "/sites", graphCollectionSchema(graphSiteSchema), { $top: String(top), $search: "*" });
          return response.value.map((site) => this.normalizeSite(site as GraphSite));
        }
        case "list": {
          const siteId = this.resolveSiteId(options);
          const response = await this.request("GET", `/sites/${siteId}/lists`, graphCollectionSchema(graphListSchema), { $top: String(top) });
          return response.value.map((list) => this.normalizeList(list as GraphList));
        }
        case "driveitem": {
          const driveId = this.resolveDriveId(options);
          const folderId = options?.filters?.["folderId"] as string | undefined;
          const path = folderId
            ? `/drives/${driveId}/items/${folderId}/children`
            : `/drives/${driveId}/root/children`;
          const response = await this.request("GET", path, graphCollectionSchema(graphDriveItemSchema), { $top: String(top) });
          return response.value.map((item) => this.normalizeDriveItem(item as GraphDriveItem));
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  async fetchEntity(entityType: string, externalId: string): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    const type = this.validateEntityType(entityType);
    const tenantId = this.credentials?.tenantId ?? "default";

    return this.withRateLimit(tenantId, async () => {
      try {
        switch (type) {
          case "site": {
            const site = await this.request("GET", `/sites/${externalId}`, graphSiteSchema);
            return this.normalizeSite(site);
          }
          case "list": {
            const siteId = this.siteId;
            if (!siteId) throw new ValidationError(this.provider, "siteId is required in credentials to fetch a list by id.");
            const list = await this.request("GET", `/sites/${siteId}/lists/${externalId}`, graphListSchema);
            return this.normalizeList(list);
          }
          case "driveitem": {
            const driveId = this.driveId;
            if (!driveId) throw new ValidationError(this.provider, "driveId is required in credentials to fetch a drive item by id.");
            const item = await this.request("GET", `/drives/${driveId}/items/${externalId}`, graphDriveItemSchema);
            return this.normalizeDriveItem(item);
          }
        }
      } catch (error) {
        if (error instanceof IntegrationError && error.code === "NOT_FOUND") return null;
        throw error;
      }
    });
  }

  // -------------------------------------------------------------------------
  // pushUpdate — updates a SharePoint list item's fields
  // -------------------------------------------------------------------------

  async pushUpdate(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    this.ensureConnected();
    this.validateEntityType(entityType);
    const tenantId = this.credentials?.tenantId ?? "default";

    const siteId = this.siteId;
    const listId = data["listId"];
    if (!siteId) throw new ValidationError(this.provider, "siteId is required in credentials for pushUpdate.");
    if (typeof listId !== "string") throw new ValidationError(this.provider, "pushUpdate requires data.listId (string).");

    const fields = { ...data };
    delete fields["listId"];

    await this.withRateLimit(tenantId, () =>
      this.request(
        "PATCH",
        `/sites/${siteId}/lists/${listId}/items/${externalId}/fields`,
        z.unknown(),
        undefined,
        fields,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Normalisation
  // -------------------------------------------------------------------------

  private normalizeSite(site: GraphSite): NormalizedEntity {
    return {
      id: site.id,
      externalId: site.id,
      provider: this.provider,
      type: "site",
      data: site as Record<string, unknown>,
      metadata: {
        fetchedAt: new Date(),
        version: site.lastModifiedDateTime,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  private normalizeList(list: GraphList): NormalizedEntity {
    return {
      id: list.id,
      externalId: list.id,
      provider: this.provider,
      type: "list",
      data: list as Record<string, unknown>,
      metadata: {
        fetchedAt: new Date(),
        version: list.lastModifiedDateTime,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  private normalizeDriveItem(item: GraphDriveItem): NormalizedEntity {
    return {
      id: item.id,
      externalId: item.id,
      provider: this.provider,
      type: "driveitem",
      data: item as Record<string, unknown>,
      metadata: {
        fetchedAt: new Date(),
        version: item.lastModifiedDateTime,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // HTTP client
  // -------------------------------------------------------------------------

  private async request<T>(
    method: "GET" | "PATCH" | "POST" | "DELETE",
    path: string,
    schema: z.ZodType<T>,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${this.adapterConfig?.baseUrl ?? GRAPH_API_BASE}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }

    const timeoutMs = this.adapterConfig?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.withRetry(async () => fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }), this.adapterConfig?.retryAttempts ?? 3);

      if (response.ok || response.status === 204) {
        if (response.status === 204) return schema.parse(undefined);
        const parsed = schema.safeParse(await response.json());
        if (!parsed.success) throw new ValidationError(this.provider, `Invalid SharePoint response schema: ${parsed.error.message}`);
        return parsed.data;
      }
      await this.throwMappedError(response);
      throw new IntegrationError("Unexpected SharePoint error", "UNKNOWN", this.provider, true);
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new IntegrationError("SharePoint request timed out", "TIMEOUT", this.provider, true);
      }
      throw error;
    } finally {
      clearTimeout(handle);
    }
  }

  private async throwMappedError(response: Response): Promise<never> {
    let payload: GraphErrorResponse = {};
    try { payload = graphErrorSchema.parse(await response.json()); } catch { /* ignore */ }
    const message = payload.error?.message ?? `SharePoint request failed with status ${response.status}`;
    const code = payload.error?.code ?? "";

    if (response.status === 401 || response.status === 403) throw new AuthError(this.provider, message);
    if (response.status === 404 || code === "itemNotFound") throw new IntegrationError(message, "NOT_FOUND", this.provider, false);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      throw new RateLimitError(this.provider, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
    }
    if (response.status >= 400 && response.status < 500) throw new ValidationError(this.provider, message);
    throw new IntegrationError(message, "SHAREPOINT_API_ERROR", this.provider, true);
  }

  private isAbortError(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
  }

  private resolveSiteId(options?: FetchOptions): string {
    const fromOptions = options?.filters?.["siteId"];
    const id = typeof fromOptions === "string" ? fromOptions : this.siteId;
    if (!id) throw new ValidationError(this.provider, "siteId is required: set it in credentials or options.filters.siteId.");
    return id;
  }

  private resolveDriveId(options?: FetchOptions): string {
    const fromOptions = options?.filters?.["driveId"];
    const id = typeof fromOptions === "string" ? fromOptions : this.driveId;
    if (!id) throw new ValidationError(this.provider, "driveId is required: set it in credentials or options.filters.driveId.");
    return id;
  }

  private validateEntityType(entityType: string): SharePointEntityType {
    const supported: SharePointEntityType[] = ["site", "list", "driveitem"];
    if (!supported.includes(entityType as SharePointEntityType)) {
      throw new ValidationError(this.provider, `Unsupported entity type: ${entityType}. Supported: ${supported.join(", ")}`);
    }
    return entityType as SharePointEntityType;
  }

  private readConfiguredCredentials(): SharePointConfigCredentials {
    return (this.config.credentials ?? {}) as SharePointConfigCredentials;
  }
}
