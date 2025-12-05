# mTLS / Service Mesh Rollout Plan

This document outlines the steps to deploy authenticated inter-service traffic using mTLS and a mesh.

## Goals
- Service-to-service authentication with SPIFFE/SAN identities.
- Traffic encryption in transit with mutual TLS.
- Fine-grained network policy and observability.

## Rollout Steps
1) **Mesh selection:** Istio or Linkerd (either supports SPIFFE IDs). Enable sidecar injection for agent services, LLM proxy, API gateway, and queue workers.
2) **Identity:** Issue SPIFFE IDs per service (`spiffe://valuecanvas/{service}`); configure workload identity via mesh cert manager. Disable plaintext intra-cluster traffic.
3) **Peer auth:** Default `STRICT` mTLS in the mesh namespace(s). Create `PeerAuthentication`/`Policy` objects enforcing mTLS for all workloads.
4) **AuthZ:** Create `AuthorizationPolicy`/`Server` objects to allow only expected callers (e.g., API gateway -> agent services; agents -> DB/LLM proxy). Deny all else.
5) **Egress control:** Require all external calls (LLM providers, Supabase) to go through egress gateways with allowlists; block direct pod egress.
6) **Certificates:** Use mesh-managed certs (Istio CA/Linkerd identity) with short TTLs and automatic rotation.
7) **Telemetry:** Enable mesh access logs and metrics; export to SIEM/monitoring. Alert on mTLS handshake failures and denied requests.
8) **Gradual rollout:** Start in staging; enable STRICT mTLS per namespace; validate health checks; then roll to production.

## Client Integration
- Internal HTTP clients should verify peer identity (SPIFFE/SAN) and set `X-Service-Identity` headers only as a fallback for legacy paths.
- Keep outbound nonce/timestamp signing (`X-Request-Nonce`, `X-Request-Timestamp`) until all callers are on the mesh; remove once mesh authZ is authoritative.

## Network Policies
- Apply Kubernetes `NetworkPolicy` (or cloud SGs) for default-deny; allow only mesh control-plane, sidecar, and required destinations (DB, Redis, egress gateway).
- Separate namespaces for agents, control-plane, data-plane services.

## Verification
- CI smoke tests for mTLS-only connectivity (no plaintext).
- Integration test: call internal service without cert -> fail; with wrong SPIFFE -> fail; with correct SPIFFE -> pass.
- Monitor mesh metrics for handshake failures and denied authZ.
