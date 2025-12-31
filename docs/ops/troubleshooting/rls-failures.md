# RLS / Auth Failures (Permission Denied)

**Goal:** Resolve `permission denied` and `policy restriction` errors for end users and service accounts.

## Symptoms
- API responses return HTTP 401/403 with `permission denied` messages.
- Supabase/PostgreSQL logs show `policy` or `rls` violations.
- JWT audience mismatches reported in gateway or Edge Functions logs.

## First-Response Checklist
1. Identify whether the error affects **all tenants** or a **single tenant**.
2. Collect a failing request ID and JWT (redact secrets) from logs or the client.
3. Announce investigation in `#incidents` and tag the **Auth Owner**.

## Triage Procedure
1. **Reproduce with policy simulation**
   - In Supabase SQL editor or psql, set the role and claim context:
     ```sql
     set role app_user;
     select set_config('request.jwt.claims', '{"sub":"<user_id>","role":"member","tenant_id":"<tenant>"}', true);
     explain analyze select * from documents where id = '<doc_id>';
     ```
   - If the query still fails, note the rejected policy.
2. **Decode JWT locally**
   - Inspect issuer, audience, and expiration:
     ```bash
     python - <<'PY'
     import base64, json, sys
     token = sys.argv[1].split('.')[1]
     padded = token + '=' * (-len(token) % 4)
     print(json.dumps(json.loads(base64.urlsafe_b64decode(padded)), indent=2))
     PY "$JWT"
     ```
   - Ensure `aud` matches the API gateway config and `tenant_id`/`role` claims exist.
3. **Check RLS policies deployed**
   - List active policies for the table:
     ```sql
     SELECT tablename, policyname, permissive, roles, cmd
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'documents';
     ```
   - Verify policy ordering matches `docs/RLS_QUICK_REFERENCE.md`.
4. **Validate service roles and keys**
   - Ensure the calling service uses the correct `service_role` key for administrative actions.
   - Rotate leaked keys immediately via Supabase dashboard (Project Settings → API → Regenerate).
5. **Confirm gateway configuration**
   - Check Envoy/NGINX route for audience enforcement and tenant headers.
   - If misconfigured, trigger config sync via GitHub Actions: https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml

## Observability Queries
- **Loki (LogQL) to find 403 spikes by route**
  ```logql
  sum by(route) (rate({app="gateway", status="403"} [5m]))
  ```
- **Loki to identify JWT validation errors**
  ```logql
  count_over_time({app="gateway"} |= "JWT" |= "invalid" [10m])
  ```
- **SQL to find denied requests per tenant**
  ```sql
  SELECT tenant_id, count(*) AS denied_count, max(created_at) AS last_seen
  FROM audit_log
  WHERE status = 'denied'
    AND created_at > now() - interval '1 hour'
  GROUP BY tenant_id
  ORDER BY denied_count DESC;
  ```

## Common Fixes
- Missing `tenant_id` claim → update issuing service to add the claim; invalidate old tokens.
- Policy too restrictive → adjust `policyname` to include the new role, then run `supabase db push`.
- Expired JWT → confirm clock skew; if >30s, resync NTP on gateway nodes.

## Escalation
- If multiple tenants are blocked for >15 minutes, classify as P1 and prepare rollback using `docs/ops/runbooks/rollback.md`.
- For single-tenant impacts, open a P2 and provide a temporary support token while you fix the policy.
