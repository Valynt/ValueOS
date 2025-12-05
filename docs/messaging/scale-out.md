# Messaging scale-out and rollout strategy

## Kubernetes deployment model
- **Redis broker**: StatefulSet with PVC-backed storage, liveness/readiness probes, and conservative resource requests to avoid eviction.
- **Message workers**: Deployment with two replicas by default, Prometheus scrape annotations, and exec-based health checks to keep pods in the Service mesh only when the Node.js process is live.
- **HorizontalPodAutoscaler**: CPU (70%) and memory (75%) targets scale workers between 1–5 replicas. For high-traffic events, increase limits and add custom metrics for stream lag once available.

## Rollout and resilience
- Use rolling updates with `maxUnavailable=1` (set via higher-level kustomize/Helm) to keep at least one worker serving during deploys.
- Brokers should be upgraded using partitioned failover (one pod at a time) to preserve stream state.
- Before deploys, drain workers with `kubectl rollout restart deploy/message-worker` and wait for in-flight messages to ack, preventing duplicate processing.

## Autoscaling triggers
- **CPU utilization**: primary signal for LLM post-processing or JSON serialization overhead.
- **Memory utilization**: protects workers from heap pressure during large payload fan-out.
- **Backlog observation**: monitor `valuecanvas.events` stream length and DLQ growth; add custom metrics to drive autoscaling when CPU is low but lag is high.

## Beyond docker-compose
- Keep Redis running as a managed service or StatefulSet; workers scale horizontally without changing application containers.
- Use dedicated namespaces and network policies to isolate messaging traffic from the public API surface.
- For multi-tenant isolation, shard streams per tenant (`valuecanvas.events.<tenant>`) and scale workers by shard ownership.
