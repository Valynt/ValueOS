/**
 * Slack Adapter
 *
 * Implements the Slack Web API for channel, message, and user entity access.
 * Uses a bot token (xoxb-*) for authentication.
 * All entities include tenant isolation via credentials.tenantId.
 *
 * Supported entity types: channel, message, user
 * pushUpdate posts a message to a channel (entityType=channel, externalId=channelId).
 */

import { z } from "zod";

import {
  AuthError,
  EnterpriseAdapter,
  IntegrationError,
  RateLimiter,
  RateLimitError,
  ValidationError,
} from "../base/index.js";
import type { FetchOptions, IntegrationConfig, NormalizedEntity } from "../base/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLACK_API_BASE = "https://slack.com/api";
const DEFAULT_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SlackEntityType = "channel" | "message" | "user";

interface SlackBaseResponse {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
}

interface SlackChannel {
  id: string;
  name: string;
  is_archived?: boolean;
  is_private?: boolean;
  created?: number;
  updated?: number;
  topic?: { value?: string };
  purpose?: { value?: string };
  num_members?: number;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  type?: string;
  subtype?: string;
}

interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  profile?: { email?: string; display_name?: string };
  updated?: number;
  deleted?: boolean;
}

interface SlackChannelListResponse extends SlackBaseResponse {
  channels: SlackChannel[];
}

interface SlackMessageListResponse extends SlackBaseResponse {
  messages: SlackMessage[];
}

interface SlackUserListResponse extends SlackBaseResponse {
  members: SlackUser[];
}

interface SlackAuthTestResponse extends SlackBaseResponse {
  user_id?: string;
  team?: string;
}

interface SlackPostMessageResponse extends SlackBaseResponse {
  ts?: string;
  channel?: string;
}

interface SlackConfigCredentials {
  accessToken?: string;
}

interface SlackAdapterConfig {
  baseUrl: string;
  authMode: "bot_token";
  timeoutMs: number;
  retryAttempts: number;
}

const slackBaseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  response_metadata: z.object({ next_cursor: z.string().optional() }).optional(),
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SlackAdapter extends EnterpriseAdapter {
  readonly provider = "slack";

  private botToken: string | null = null;
  private adapterConfig: SlackAdapterConfig | null = null;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "slack",
      requestsPerMinute: 50,
      burstLimit: 20,
    }));
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  protected async doConnect(): Promise<void> {
    const configured = this.readConfiguredCredentials();
    this.adapterConfig = {
      baseUrl: this.config.baseUrl ?? SLACK_API_BASE,
      authMode: "bot_token",
      timeoutMs: this.config.timeout ?? DEFAULT_TIMEOUT_MS,
      retryAttempts: this.config.retryAttempts ?? 1,
    };
    const token = this.credentials?.accessToken ?? configured.accessToken;
    if (!token) {
      throw new AuthError(this.provider, "Slack bot token (xoxb-*) is required in connect credentials or IntegrationConfig.credentials.");
    }
    this.botToken = token;
  }

  protected async doDisconnect(): Promise<void> {
    this.botToken = null;
    this.adapterConfig = null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  async validate(): Promise<boolean> {
    this.ensureConnected();
    try {
      const response = await this.call("auth.test", {}, slackBaseSchema.extend({ user_id: z.string().optional(), team: z.string().optional() }));
      return response.ok;
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
    const tenantId = this.credentials?.tenantId ?? "default";
    const limit = options?.limit ?? 100;

    return this.withRateLimit(tenantId, async () => {
      switch (type) {
        case "channel": {
          const response = await this.call("conversations.list", {
            limit: String(limit),
            exclude_archived: "true",
          }, slackBaseSchema.extend({ channels: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()).optional() }));
          return (response.channels ?? []).map((c) => this.normalizeChannel(c as SlackChannel));
        }
        case "user": {
          const response = await this.call("users.list", {
            limit: String(limit),
          }, slackBaseSchema.extend({ members: z.array(z.object({ id: z.string() }).passthrough()).optional() }));
          return (response.members ?? []).map((u) => this.normalizeUser(u as SlackUser));
        }
        case "message": {
          // Messages require a channel — use filters.channelId
          const channelId = options?.filters?.["channelId"];
          if (typeof channelId !== "string") {
            throw new ValidationError(this.provider, "fetchEntities for 'message' requires options.filters.channelId");
          }
          const params: Record<string, string> = { channel: channelId, limit: String(limit) };
          if (options?.since) params["oldest"] = String(options.since.getTime() / 1000);
          const response = await this.call("conversations.history", params, slackBaseSchema.extend({ messages: z.array(z.object({ ts: z.string() }).passthrough()).optional() }));
          return (response.messages ?? []).map((m) => this.normalizeMessage(channelId, m as SlackMessage));
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
          case "channel": {
            const response = await this.call("conversations.info", { channel: externalId }, slackBaseSchema.extend({ channel: z.object({ id: z.string(), name: z.string() }).passthrough().optional() }));
            if (!response.channel) return null;
            return this.normalizeChannel(response.channel as SlackChannel);
          }
          case "user": {
            const response = await this.call("users.info", { user: externalId }, slackBaseSchema.extend({ user: z.object({ id: z.string() }).passthrough().optional() }));
            if (!response.user) return null;
            return this.normalizeUser(response.user as SlackUser);
          }
          case "message":
            // Slack has no single-message fetch by ts without channel context
            throw new ValidationError(this.provider, "fetchEntity for 'message' is not supported. Use fetchEntities with filters.channelId.");
        }
      } catch (error) {
        if (error instanceof IntegrationError && error.code === "NOT_FOUND") return null;
        throw error;
      }
    });
  }

  // -------------------------------------------------------------------------
  // pushUpdate — posts a message to a channel
  // -------------------------------------------------------------------------

  async pushUpdate(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    this.ensureConnected();
    this.validateEntityType(entityType);
    const tenantId = this.credentials?.tenantId ?? "default";

    const text = data["text"];
    if (typeof text !== "string" || text.trim() === "") {
      throw new ValidationError(this.provider, "pushUpdate requires data.text (string) to post a Slack message.");
    }

    const params: Record<string, string> = { channel: externalId, text };
    if (typeof data["thread_ts"] === "string") params["thread_ts"] = data["thread_ts"];

    await this.withRateLimit(tenantId, () =>
      this.call("chat.postMessage", params, slackBaseSchema.extend({ ts: z.string().optional(), channel: z.string().optional() }), "POST"),
    );
  }

  // -------------------------------------------------------------------------
  // Normalisation
  // -------------------------------------------------------------------------

  private normalizeChannel(channel: SlackChannel): NormalizedEntity {
    return {
      id: channel.id,
      externalId: channel.id,
      provider: this.provider,
      type: "channel",
      data: channel as unknown as Record<string, unknown>,
      metadata: {
        fetchedAt: new Date(),
        version: channel.updated ? String(channel.updated) : undefined,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  private normalizeUser(user: SlackUser): NormalizedEntity {
    return {
      id: user.id,
      externalId: user.id,
      provider: this.provider,
      type: "user",
      data: user as unknown as Record<string, unknown>,
      metadata: {
        fetchedAt: new Date(),
        version: user.updated ? String(user.updated) : undefined,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  private normalizeMessage(channelId: string, message: SlackMessage): NormalizedEntity {
    return {
      id: `${channelId}:${message.ts}`,
      externalId: message.ts,
      provider: this.provider,
      type: "message",
      data: { ...message, channelId },
      metadata: {
        fetchedAt: new Date(),
        version: message.ts,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // HTTP client
  // -------------------------------------------------------------------------

  private async call<T extends SlackBaseResponse>(
    method: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
    httpMethod: "GET" | "POST" = "GET",
  ): Promise<T> {
    const url = new URL(`${this.adapterConfig?.baseUrl ?? SLACK_API_BASE}/${method}`);

    // GET requests pass params as query string; POST requests send JSON body.
    let body: string | undefined;
    if (httpMethod === "GET") {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    } else {
      body = JSON.stringify(params);
    }

    const timeoutMs = this.adapterConfig?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.withRetry(async () => fetch(url.toString(), {
        method: httpMethod,
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": httpMethod === "POST" ? "application/json; charset=utf-8" : "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      }), this.adapterConfig?.retryAttempts ?? 3);

      if (!response.ok) {
        await this.throwHttpError(response);
      }

      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) {
        throw new ValidationError(this.provider, `Invalid Slack response schema: ${parsed.error.message}`);
      }
      const responseBody = parsed.data;
      if (!responseBody.ok) {
        this.throwSlackError(responseBody.error ?? "unknown_error");
      }
      return responseBody;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new IntegrationError("Slack request timed out", "TIMEOUT", this.provider, true);
      }
      throw error;
    } finally {
      clearTimeout(handle);
    }
  }

  private throwSlackError(errorCode: string): never {
    if (errorCode === "invalid_auth" || errorCode === "not_authed" || errorCode === "token_revoked") {
      throw new AuthError(this.provider, `Slack auth error: ${errorCode}`);
    }
    if (errorCode === "channel_not_found" || errorCode === "user_not_found") {
      throw new IntegrationError(`Slack: ${errorCode}`, "NOT_FOUND", this.provider, false);
    }
    if (errorCode === "ratelimited") {
      throw new RateLimitError(this.provider, 1000);
    }
    throw new IntegrationError(`Slack API error: ${errorCode}`, "SLACK_API_ERROR", this.provider, true);
  }

  private async throwHttpError(response: Response): Promise<never> {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      throw new RateLimitError(this.provider, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
    }
    throw new IntegrationError(`Slack HTTP error: ${response.status}`, "HTTP_ERROR", this.provider, response.status >= 500);
  }

  private isAbortError(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
  }

  private validateEntityType(entityType: string): SlackEntityType {
    const supported: SlackEntityType[] = ["channel", "message", "user"];
    if (!supported.includes(entityType as SlackEntityType)) {
      throw new ValidationError(this.provider, `Unsupported entity type: ${entityType}. Supported: ${supported.join(", ")}`);
    }
    return entityType as SlackEntityType;
  }

  private readConfiguredCredentials(): SlackConfigCredentials {
    return (this.config.credentials ?? {}) as SlackConfigCredentials;
  }
}
