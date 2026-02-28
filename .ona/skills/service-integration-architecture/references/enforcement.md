# Integration Enforcement

CI checks, generator script, and health registry that make the 4-layer standard binding.

## Table of Contents

- [CI Lint Script](#ci-lint-script)
- [Generator Script](#generator-script)
- [Integration Health Registry](#integration-health-registry)
- [Startup Probe Pattern](#startup-probe-pattern)

---

## CI Lint Script

Add to `.github/workflows/ci.yml` as a job or step. Fails the PR if any integration
under `packages/integrations/` violates the standard.

```bash
#!/usr/bin/env bash
# scripts/lint-integrations.sh
# Run in CI to enforce integration architecture standard.
set -euo pipefail

INTEGRATIONS_DIR="packages/integrations"
REQUIRED_FILES=("index.ts" "config.ts" "errors.ts" "health.ts")
SKIP_DIRS=("base" "node_modules")
EXIT_CODE=0

for dir in "$INTEGRATIONS_DIR"/*/; do
  provider=$(basename "$dir")

  # Skip non-provider directories
  skip=false
  for s in "${SKIP_DIRS[@]}"; do
    [[ "$provider" == "$s" ]] && skip=true
  done
  $skip && continue

  echo "Checking $provider..."

  # 1. Required files
  for f in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$dir/$f" ]]; then
      echo "  FAIL: missing $f"
      EXIT_CODE=1
    fi
  done

  # 2. Config must use Zod
  if [[ -f "$dir/config.ts" ]]; then
    if ! grep -q "from 'zod'\|from \"zod\"" "$dir/config.ts"; then
      echo "  FAIL: config.ts does not import zod"
      EXIT_CODE=1
    fi
  fi

  # 3. Health check must export checkHealth or checkProviderHealth
  if [[ -f "$dir/health.ts" ]]; then
    if ! grep -qE "export (async )?function check.+Health" "$dir/health.ts"; then
      echo "  FAIL: health.ts missing exported checkHealth function"
      EXIT_CODE=1
    fi
  fi

  # 4. No raw 'any' in provider files (excluding __tests__)
  any_count=$(grep -rn ': any\b\|as any\b\|<any>' "$dir" \
    --include='*.ts' --exclude-dir='__tests__' \
    --exclude-dir='node_modules' | wc -l || true)
  if [[ "$any_count" -gt 0 ]]; then
    echo "  WARN: $any_count occurrences of 'any' found"
    # Uncomment to make this a hard fail:
    # EXIT_CODE=1
  fi

  # 5. Service files must reference organization_id or tenant_id
  if [[ -d "$dir/services" ]]; then
    for svc in "$dir/services"/*.ts; do
      [[ ! -f "$svc" ]] && continue
      if grep -q "\.from(" "$svc" && ! grep -q "organization_id\|tenant_id" "$svc"; then
        echo "  FAIL: $(basename "$svc") has DB queries without tenant scoping"
        EXIT_CODE=1
      fi
    done
  fi

  # 6. Webhook handlers must verify signatures
  if [[ -d "$dir/handlers" && -f "$dir/handlers/webhooks.ts" ]]; then
    if ! grep -q "verifySignature\|createHmac\|timingSafeEqual" "$dir/handlers/webhooks.ts"; then
      echo "  FAIL: webhooks.ts missing signature verification"
      EXIT_CODE=1
    fi
  fi
done

exit $EXIT_CODE
```

Add to CI:

```yaml
# In .github/workflows/ci.yml
- name: Lint integration architecture
  run: bash scripts/lint-integrations.sh
```

---

## Generator Script

Scaffold a new integration with all required files. Use `pnpm scaffold:integration <name>`.

Add to root `package.json`:

```json
"scaffold:integration": "bash scripts/scaffold-integration.sh"
```

```bash
#!/usr/bin/env bash
# scripts/scaffold-integration.sh
set -euo pipefail

PROVIDER="${1:?Usage: scaffold-integration.sh <provider-name>}"
PROVIDER_LOWER=$(echo "$PROVIDER" | tr '[:upper:]' '[:lower:]')
PROVIDER_UPPER=$(echo "$PROVIDER" | sed 's/\b\(.\)/\u\1/g' | tr -d ' -')
DIR="packages/integrations/$PROVIDER_LOWER"

if [[ -d "$DIR" ]]; then
  echo "Error: $DIR already exists" >&2
  exit 1
fi

mkdir -p "$DIR"/{handlers,services,jobs,__tests__}

# config.ts
cat > "$DIR/config.ts" << 'EOF'
import { z } from 'zod';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  webhookSecret: z.string().optional(),
  timeout: z.coerce.number().default(10_000),
});

export type PROVIDER_CONFIG_TYPE = z.infer<typeof configSchema>;

export function loadConfig(): PROVIDER_CONFIG_TYPE {
  return configSchema.parse({
    apiKey: process.env.PROVIDER_UPPER_API_KEY,
    baseUrl: process.env.PROVIDER_UPPER_BASE_URL,
    webhookSecret: process.env.PROVIDER_UPPER_WEBHOOK_SECRET,
    timeout: process.env.PROVIDER_UPPER_TIMEOUT,
  });
}
EOF
sed -i "s/PROVIDER_CONFIG_TYPE/${PROVIDER_UPPER}Config/g" "$DIR/config.ts"
sed -i "s/PROVIDER_UPPER/$(echo "$PROVIDER_LOWER" | tr '[:lower:]' '[:upper:]')/g" "$DIR/config.ts"

# errors.ts
cat > "$DIR/errors.ts" << EOF
export class ${PROVIDER_UPPER}ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = '${PROVIDER_UPPER}ServiceError';
  }
}

export function wrap${PROVIDER_UPPER}Error(error: unknown): ${PROVIDER_UPPER}ServiceError {
  if (error instanceof ${PROVIDER_UPPER}ServiceError) return error;
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('429')) return new ${PROVIDER_UPPER}ServiceError('Rate limited', 'RATE_LIMITED', true, 429, error);
  if (msg.includes('5')) return new ${PROVIDER_UPPER}ServiceError('Server error', 'SERVER_ERROR', true, 500, error);
  return new ${PROVIDER_UPPER}ServiceError(msg, 'UNKNOWN', false, undefined, error);
}
EOF

# health.ts
cat > "$DIR/health.ts" << EOF
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export async function check${PROVIDER_UPPER}Health(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    // Replace with lightest possible API call
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
EOF

# Adapter
cat > "$DIR/${PROVIDER_UPPER}Adapter.ts" << EOF
import {
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimiter,
} from '../base/index.js';

export class ${PROVIDER_UPPER}Adapter extends EnterpriseAdapter {
  readonly provider = '${PROVIDER_LOWER}';

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: '${PROVIDER_LOWER}',
      requestsPerMinute: 60,
      burstLimit: 10,
    }));
  }

  protected async doConnect(): Promise<void> {
    // TODO: Initialize ${PROVIDER_UPPER} client
  }

  protected async doDisconnect(): Promise<void> {
    // TODO: Cleanup
  }

  async validate(): Promise<boolean> {
    this.ensureConnected();
    // TODO: Validate credentials
    return true;
  }

  async fetchEntities(entityType: string, _options?: FetchOptions): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    // TODO: Fetch and normalize entities
    return [];
  }

  async fetchEntity(entityType: string, externalId: string): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    // TODO: Fetch single entity
    return null;
  }

  async pushUpdate(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    this.ensureConnected();
    // TODO: Push update
  }
}
EOF

# types.ts
cat > "$DIR/types.ts" << EOF
// Provider-specific typed DTOs. Map vendor payloads to these before returning.
export interface ${PROVIDER_UPPER}Resource {
  id: string;
  // TODO: Add provider-specific fields
}
EOF

# index.ts
cat > "$DIR/index.ts" << EOF
export { ${PROVIDER_UPPER}Adapter } from './${PROVIDER_UPPER}Adapter.js';
export { check${PROVIDER_UPPER}Health } from './health.js';
export type { ${PROVIDER_UPPER}Resource } from './types.js';
export type { HealthStatus } from './health.js';
EOF

# Test stub
cat > "$DIR/__tests__/adapter.test.ts" << EOF
import { describe, it, expect } from 'vitest';

describe('${PROVIDER_UPPER}Adapter', () => {
  it.todo('connects and validates credentials');
  it.todo('fetches and normalizes entities');
  it.todo('wraps SDK errors in ${PROVIDER_UPPER}ServiceError');
});
EOF

echo "Scaffolded $DIR"
echo "Next steps:"
echo "  1. Implement doConnect/doDisconnect in ${PROVIDER_UPPER}Adapter.ts"
echo "  2. Fill in health check with real ping call"
echo "  3. Register in integration health registry"
echo "  4. Write tests"
```

---

## Integration Health Registry

Central registry where each integration exports its health check. Serves `/health/deps`.

```typescript
// packages/backend/src/services/IntegrationHealthRegistry.ts
import { z } from 'zod';

export interface IntegrationHealthEntry {
  name: string;
  configSchema: z.ZodType;
  checkHealth: () => Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }>;
  isEnabled: () => boolean;
  required: boolean; // if true, unhealthy → readiness fails
}

const registry: IntegrationHealthEntry[] = [];

export function registerIntegration(entry: IntegrationHealthEntry): void {
  registry.push(entry);
}

export function getRegisteredIntegrations(): readonly IntegrationHealthEntry[] {
  return registry;
}

export async function checkAllIntegrations(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  integrations: Array<{
    name: string;
    enabled: boolean;
    status: string;
    latencyMs?: number;
    error?: string;
    required: boolean;
  }>;
}> {
  const results = await Promise.allSettled(
    registry.map(async (entry) => {
      if (!entry.isEnabled()) {
        return { name: entry.name, enabled: false, status: 'disabled' as const, required: entry.required };
      }
      const health = await entry.checkHealth();
      return { name: entry.name, enabled: true, ...health, required: entry.required };
    })
  );

  const integrations = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: registry[i].name, enabled: true, status: 'unhealthy' as const, error: String(r.reason), required: registry[i].required }
  );

  const requiredUnhealthy = integrations.some(
    (i) => i.required && i.enabled && i.status === 'unhealthy'
  );
  const anyUnhealthy = integrations.some(
    (i) => i.enabled && i.status === 'unhealthy'
  );

  return {
    status: requiredUnhealthy ? 'unhealthy' : anyUnhealthy ? 'degraded' : 'healthy',
    integrations,
  };
}
```

Wire to Express:

```typescript
// In backend route setup
import { checkAllIntegrations } from '../services/IntegrationHealthRegistry.js';

router.get('/health/deps', async (_req, res) => {
  const result = await checkAllIntegrations();
  const code = result.status === 'unhealthy' ? 503 : 200;
  res.status(code).json(result);
});
```

Register an integration:

```typescript
// packages/integrations/hubspot/register.ts
import { registerIntegration } from '@backend/services/IntegrationHealthRegistry.js';
import { checkHubSpotHealth } from './health.js';
import { z } from 'zod';

registerIntegration({
  name: 'hubspot',
  configSchema: z.object({ apiKey: z.string(), baseUrl: z.string().url() }),
  checkHealth: checkHubSpotHealth,
  isEnabled: () => Boolean(process.env.HUBSPOT_API_KEY),
  required: false, // does not block readiness
});
```

---

## Startup Probe Pattern

Integrations must not make network calls on module import. Lazy-initialize behind the adapter's `connect()` method.

```typescript
// BAD — blocks startup, causes crash loops
export class BadAdapter {
  private client = new SdkClient(process.env.API_KEY!); // network call on import
}

// GOOD — deferred initialization
export class GoodAdapter extends EnterpriseAdapter {
  private client: SdkClient | null = null;

  protected async doConnect(): Promise<void> {
    this.client = new SdkClient(loadConfig().apiKey);
    await this.client.ping(); // only called when explicitly connected
  }
}
```

K8s startup probe should hit `/health/startup` which checks that the server is listening, not that all integrations are connected. Integration health goes to `/health/deps` only.
