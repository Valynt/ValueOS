# Read Cache Rollout (Projects, Workflows, Analytics)

## Top read endpoints query

Use the existing route metric to identify read-heavy routes:

```promql
topk(10, sum by (route) (rate(valuecanvas_http_requests_total{method="GET",status_code=~"2.."}[5m])))
```

For this rollout, the targeted endpoints are:

- `/api/projects`
- `/api/projects/:projectId`
- `/api/workflows/:id`
- `/api/analytics/summary`

## Cache policy

- `hot` tier: `30s` (volatile reads)
- `warm` tier: `2m` (moderately volatile)
- `cold` tier: `10m` (stable reads)

## Validation metrics

- `valuecanvas_read_cache_events_total{event="hit"|"miss"|"eviction"}`
- `valuecanvas_http_requests_total{method="GET"}`

Dashboard JSON: `infra/k8s/monitoring/read-cache-grafana-dashboard.json`.
