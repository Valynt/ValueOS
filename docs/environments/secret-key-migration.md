# Secret Key Naming Migration (kebab-case canonical)

## Summary

Kubernetes `valynt-secrets` keys now use **kebab-case only**. Snake_case aliases were removed from `infra/k8s/base/external-secrets.yaml`.

## Canonical key mapping

| Deprecated key | Canonical key |
|---|---|
| `database_url` | `database-url` |
| `supabase_url` | `supabase-url` |
| `supabase_service_key` | `supabase-service-key` |

## Required application env names

Consumers must use the canonical environment variables below:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOGETHER_API_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `SESSION_SECRET`

## Breaking changes

- `SUPABASE_SERVICE_KEY` is no longer accepted by backend config loaders.
- `SUPABASE_SERVICE_KEY_SECRET_NAME` is no longer accepted by secret hydration.

Update any stale local env files, Kubernetes manifests, or CI variables before deploying.
