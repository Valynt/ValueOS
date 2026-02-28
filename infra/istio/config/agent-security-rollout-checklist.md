# Agent Istio Security Rollout Validation Checklist

Use this checklist after deploying updated agent manifests and Istio security policies.

## 1) Verify sidecar injection on all agent pods

- [ ] Confirm all agent Deployments include `sidecar.istio.io/inject: "true"` in pod template annotations.
  ```bash
  kubectl -n valynt-agents get deploy -l component=agent -o yaml | rg "sidecar.istio.io/inject"
  ```
- [ ] Restart rollout and verify pods contain `istio-proxy` container.
  ```bash
  kubectl -n valynt-agents rollout restart deploy -l component=agent
  kubectl -n valynt-agents get pod -l component=agent -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.name}{","}{end}{"\n"}{end}'
  ```

## 2) Verify STRICT mTLS is active

- [ ] Confirm effective PeerAuthentication in namespace.
  ```bash
  kubectl -n valynt-agents get peerauthentication
  ```
- [ ] Validate mTLS traffic with `istioctl authn tls-check` between sample workloads.
  ```bash
  istioctl authn tls-check <source-pod>.valynt-agents <target-service>.valynt-agents.svc.cluster.local
  ```

## 3) Verify JWT enforcement and tenant-claim requirements

- [ ] Confirm RequestAuthentication and AuthorizationPolicy resources are present.
  ```bash
  kubectl -n valynt-agents get requestauthentication,authorizationpolicy
  ```
- [ ] Call an agent API **without token** and verify request is denied.
  ```bash
  curl -i https://<agent-host>/api/health
  ```
- [ ] Call agent API with JWT **missing `tenant_id` claim** and verify request is denied.
- [ ] Call agent API with valid JWT containing `tenant_id` and verify request is allowed only for approved principal/routes.

## 4) Verify principal-based route and method controls

- [ ] From backend service account principal, verify allowed `/api/*` methods succeed and disallowed routes fail.
- [ ] From `valynt-agent` service account principal, verify `/api/internal/*` and `/api/workflows/*` succeed, while other `/api/*` paths are denied.
- [ ] From prometheus principal, verify only `GET /health` and `GET /metrics` are allowed.

## 5) Verify denial telemetry and auditability

- [ ] Check Istio proxy logs for `rbac_access_denied_matched_policy` on blocked requests.
  ```bash
  kubectl -n valynt-agents logs <agent-pod> -c istio-proxy --tail=200 | rg "rbac_access_denied_matched_policy"
  ```
- [ ] Confirm monitoring/alerts include authorization deny spikes and JWT validation errors.
- [ ] Record rollout evidence (command output, timestamps, and sample request IDs).
