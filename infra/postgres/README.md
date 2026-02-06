# Postgres migrations

`infra/postgres/migrations` is the authoritative migration path for schema and RLS policy enforcement in CI.

## Notes

- CI applies migrations from `infra/postgres/migrations` before running database security checks.
- `infra/migrations` is legacy bootstrap SQL and is not the source of truth for current CI schema validation.
