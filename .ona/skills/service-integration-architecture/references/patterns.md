# Integration Code Patterns

Concrete TypeScript patterns for each layer. Replace `<Provider>` / `<provider>` with the actual service name.

## Table of Contents

- [Config](#config)
- [Client Wrapper](#client-wrapper)
- [Error Boundary](#error-boundary)
- [Health Check](#health-check)
- [Service Layer](#service-layer)
- [Webhook Handler](#webhook-handler)
- [Webhook Replay Protection](#webhook-replay-protection)
- [Per-Tenant Rate Limiting](#per-tenant-rate-limiting)
- [Background Job](#background-job)
- [Testing](#testing)

---

## Config

Validate environment variables with Zod at startup. Fail fast on missing config.

```typescript
// src/config.ts
import { z } from 'zod';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  webhookSecret: z.string().min(1),
  timeout: z.coerce.number().default(10_000),
  retries: z.coerce.number().default(3),
  cache: z.object({
    enabled: z.coerce.boolean().default(true),
    ttlSeconds: z.coerce.number().default(300),
  }),
});

export type ProviderConfig = z.infer<typeof configSchema>;

export function loadProviderConfig(): ProviderConfig {
  return configSchema.parse({
    apiKey: process.env.PROVIDER_API_KEY,
    baseUrl: process.env.PROVIDER_BASE_URL,
    webhookSecret: process.env.PROVIDER_WEBHOOK_SECRET,
    timeout: process.env.PROVIDER_TIMEOUT,
    retries: process.env.PROVIDER_RETRIES,
    cache: {
      enabled: process.env.PROVIDER_CACHE_ENABLED,
      ttlSeconds: process.env.PROVIDER_CACHE_TTL,
    },
  });
}
```

---

## Client Wrapper

Extend `EnterpriseAdapter` from `packages/integrations/base/`. The base class handles
connect/disconnect lifecycle and rate limiting. Wrap SDK calls with the circuit breaker
and error boundary.

```typescript
// <Provider>Adapter.ts
import {
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimiter,
} from '../base/index.js';
import { ExternalCircuitBreaker } from '@backend/services/ExternalCircuitBreaker.js';
import { wrapProviderError } from './errors.js';
import { loadConfig } from './config.js';
import type { ProviderResource } from './types.js';

export class ProviderAdapter extends EnterpriseAdapter {
  readonly provider = 'provider';
  private breaker = new ExternalCircuitBreaker('provider');
  private sdk: ProviderSdk | null = null;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: 'provider',
      requestsPerMinute: 60,
      burstLimit: 10,
    }));
  }

  // No network calls in constructor — deferred to connect()
  protected async doConnect(): Promise<void> {
    const cfg = loadConfig();
    this.sdk = new ProviderSdk({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
    await this.sdk.ping();
  }

  protected async doDisconnect(): Promise<void> {
    this.sdk = null;
  }

  async fetchEntities(entityType: string, _options?: FetchOptions): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    return this.breaker.execute(`provider:list:${entityType}`, async () => {
      try {
        const raw = await this.sdk!.list(entityType);
        return raw.map(this.normalize);
      } catch (err) {
        throw wrapProviderError(err);
      }
    });
  }

  private normalize(raw: ProviderResource): NormalizedEntity {
    return {
      id: raw.id,
      type: raw.type,
      data: raw,
      source: 'provider',
      updatedAt: raw.updated_at,
    };
  }
}
```

For standalone clients not using `EnterpriseAdapter` (e.g., internal microservices),
use the singleton + circuit breaker pattern:

```typescript
// src/client.ts
import { ExternalCircuitBreaker } from '@backend/services/ExternalCircuitBreaker.js';
import { loadConfig } from './config.js';
import { wrapProviderError } from './errors.js';

export class ProviderClient {
  private readonly breaker = new ExternalCircuitBreaker('provider');
  private readonly config = loadConfig();

  async getResource(id: string): Promise<Resource> {
    return this.breaker.execute(`provider:get:${id}`, async () => {
      try {
        const res = await fetch(`${this.config.baseUrl}/resources/${id}`, {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Resource>;
      } catch (err) {
        throw wrapProviderError(err);
      }
    });
  }
}

let instance: ProviderClient | null = null;
export function getProviderClient(): ProviderClient {
  if (!instance) instance = new ProviderClient();
  return instance;
}
export function resetProviderClient(): void { instance = null; }
```

---

## Error Boundary

Map SDK/HTTP errors to domain errors with retryable flag.

```typescript
// src/errors.ts
export class ProviderServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderServiceError';
  }
}

export function wrapProviderError(error: unknown): ProviderServiceError {
  if (error instanceof ProviderServiceError) return error;

  const msg = error instanceof Error ? error.message : String(error);

  // Map HTTP status codes
  if (msg.includes('HTTP 429')) {
    return new ProviderServiceError('Rate limited', 'RATE_LIMITED', true, 429, error);
  }
  if (msg.includes('HTTP 5')) {
    return new ProviderServiceError('Provider server error', 'SERVER_ERROR', true, 500, error);
  }
  if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
    return new ProviderServiceError('Auth failed', 'AUTH_ERROR', false, 401, error);
  }

  return new ProviderServiceError(msg, 'UNKNOWN', false, undefined, error);
}
```

---

## Health Check

Lightweight connectivity probe for monitoring.

```typescript
// src/health.ts
import { getProviderClient } from './client.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export async function checkProviderHealth(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    // Use the lightest possible API call
    await getProviderClient().ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

---

## Service Layer

Business logic sits here. Always scope queries by tenant.

```typescript
// src/services/sync.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getProviderClient } from '../client.js';

export class ProviderSyncService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly organizationId: string
  ) {}

  async syncResources(): Promise<{ synced: number }> {
    const client = getProviderClient();
    const remote = await client.listResources();

    let synced = 0;
    for (const resource of remote) {
      const { error } = await this.supabase
        .from('provider_resources')
        .upsert({
          external_id: resource.id,
          data: resource,
          organization_id: this.organizationId, // tenant isolation
          synced_at: new Date().toISOString(),
        })
        .eq('organization_id', this.organizationId);

      if (!error) synced++;
    }
    return { synced };
  }
}
```

---

## Webhook Handler

Validate signature, parse payload with Zod, dispatch to service layer.

```typescript
// src/handlers/webhooks.ts
import { z } from 'zod';
import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { loadProviderConfig } from '../config.js';

const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string(),
});

export function verifySignature(rawBody: Buffer, signature: string): boolean {
  const config = loadProviderConfig();
  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-provider-signature'] as string;
  if (!signature || !verifySignature(req.body as Buffer, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const parsed = webhookPayloadSchema.safeParse(JSON.parse(req.body.toString()));
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  // Dispatch to service layer based on event type
  // ...

  res.status(200).json({ received: true });
}
```

---

## Webhook Replay Protection

Prevent replay attacks by tracking processed webhook event IDs with a short TTL in Redis.

```typescript
// src/handlers/replay-guard.ts
import { createClient } from 'redis';

const REPLAY_TTL_SECONDS = 300; // 5 minutes

export async function isReplay(
  redis: ReturnType<typeof createClient>,
  eventId: string
): Promise<boolean> {
  const key = `webhook:replay:${eventId}`;
  const wasSet = await redis.set(key, '1', { NX: true, EX: REPLAY_TTL_SECONDS });
  return wasSet === null; // null means key already existed → replay
}
```

Use in webhook handler:

```typescript
const eventId = req.headers['x-provider-event-id'] as string;
if (!eventId || await isReplay(redis, eventId)) {
  res.status(200).json({ ignored: true }); // 200 so provider doesn't retry
  return;
}
```

---

## Per-Tenant Rate Limiting

Webhook endpoints and API routes should apply per-tenant rate limits using
`RateLimitKeyService` from the backend.

```typescript
// In webhook route registration
import { RateLimitKeyService } from '@backend/services/RateLimitKeyService.js';

// Extract tenant from webhook payload or auth header
const tenantKey = RateLimitKeyService.forTenant(organizationId, 'provider-webhook');

// Apply rate limit (example using express-rate-limit or custom middleware)
// Key pattern: "rl:provider-webhook:<org_id>"
```

For inbound webhooks where tenant isn't known until after payload parsing,
apply a global rate limit first (by IP), then a per-tenant limit after
extracting `organization_id` from the payload.

---

## Background Job

BullMQ worker that calls the service layer.

```typescript
// src/jobs/sync.ts
import { Worker, Job } from 'bullmq';
import { ProviderSyncService } from '../services/sync.js';
import { createServiceRoleClient } from '@backend/lib/supabase.js';

interface SyncJobData {
  organizationId: string;
}

export function createSyncWorker(): Worker<SyncJobData> {
  return new Worker<SyncJobData>(
    'provider-sync',
    async (job: Job<SyncJobData>) => {
      const supabase = createServiceRoleClient(); // service_role OK for cron jobs
      const service = new ProviderSyncService(supabase, job.data.organizationId);
      return service.syncResources();
    },
    { connection: { host: 'localhost', port: 6379 } }
  );
}
```

---

## Testing

Mock the provider client, test service logic in isolation.

```typescript
// __tests__/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderSyncService } from '../src/services/sync.js';

// Mock the client module
vi.mock('../src/client.js', () => ({
  getProviderClient: () => ({
    listResources: vi.fn().mockResolvedValue([
      { id: 'ext-1', name: 'Resource 1' },
    ]),
  }),
}));

describe('ProviderSyncService', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };

  it('syncs resources scoped to organization', async () => {
    const service = new ProviderSyncService(
      mockSupabase as any,
      'org-123'
    );
    const result = await service.syncResources();

    expect(result.synced).toBe(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('provider_resources');
    // Verify tenant isolation
    expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123');
  });
});
```
