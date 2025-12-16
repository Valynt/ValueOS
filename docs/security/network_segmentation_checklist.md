# Network Segmentation & Policy Checklist (Phase 2)

- Default-deny ingress/egress namespaces for agents, API, LLM proxy, DB.
- Allow only:
  - API gateway -> API pods
  - Agents -> LLM proxy, DB, Redis
  - LLM proxy -> external LLM providers (allowlist)
  - Monitoring/logging endpoints
- Kubernetes NetworkPolicy examples:
  - Deny all by default, allow namespace-local DNS.
  - Allow specific label selectors per service path (agent->proxy, agent->db).
- Cloud SGs: mirror the same allowlist; block wildcard egress.
- Validate with `netpol` tests and packet captures; alert on policy violations.
