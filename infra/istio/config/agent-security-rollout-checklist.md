# Agent Security Rollout Validation Checklist

Use this checklist after applying the updated deployment manifests and Istio security policies.

## 1) Sidecar injection verification

- [ ] Confirm all agent pods have two containers (`app + istio-proxy`):

```bash
kubectl -n valynt-agents get pods -l component=agent -o jsonpath='{range .items[*]}{.metadata.name}{" => "}{range .spec.containers[*]}{.name}{" "}{end}{"\n"}{end}'
```

- [ ] Confirm the sidecar annotation is present on all agent Deployment pod templates:

```bash
kubectl -n valynt-agents get deploy -l component=agent -o jsonpath='{range .items[*]}{.metadata.name}{" => "}{.spec.template.metadata.annotations.sidecar\.istio\.io/inject}{"\n"}{end}'
```

## 2) mTLS STRICT verification

- [ ] Verify PeerAuthentication is STRICT:

```bash
kubectl -n valynt-agents get peerauthentication default -o yaml
```

- [ ] Verify traffic between agent workloads is mTLS (`tlsMode: istio`):

```bash
istioctl authn tls-check deploy/opportunity-agent.valynt-agents
```

## 3) Authentication and claim-based authorization checks

- [ ] Confirm JWT RequestAuthentication is installed:

```bash
kubectl -n valynt-agents get requestauthentication agent-jwt-validation -o yaml
```

- [ ] Verify unauthenticated API call is denied (expect `403`):

```bash
curl -i https://<agent-host>/api/health
```

- [ ] Verify authenticated call **without** `tenant_id` claim is denied (expect `403`):

```bash
curl -i -H "Authorization: Bearer <jwt-without-tenant-claims>" https://<agent-host>/api/health
```

- [ ] Verify authenticated call **with** `tenant_id` claim is permitted (expect `2xx`):

```bash
curl -i -H "Authorization: Bearer <jwt-with-tenant-claim>" https://<agent-host>/api/health
```

## 4) Principal + route/method restriction checks

- [ ] Verify metrics and health endpoints are only available to the Prometheus principal.
- [ ] Verify API routes (`/api/*`) are allowed only for approved service-account principals and with required claims.
- [ ] Verify disallowed methods/routes for each principal return `403`.

Suggested checks:

```bash
kubectl -n valynt-agents logs deploy/opportunity-agent -c istio-proxy --tail=200
kubectl -n valynt-agents logs deploy/target-agent -c istio-proxy --tail=200
```

## 5) Post-rollout monitoring

- [ ] Monitor 4xx/5xx changes in agent traffic for at least one release window.
- [ ] Confirm no unexpected authorization denies in Envoy/Istio telemetry.
- [ ] Roll back if critical control-plane or data-plane traffic is blocked.
