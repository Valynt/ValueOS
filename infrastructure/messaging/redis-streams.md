# Redis Streams prototype

This prototype uses Redis Streams as a lightweight broker for asynchronous workloads.

## Local development
- Reuse the existing `redis` service in `docker-compose.dev.yml` and set:
  - `REDIS_URL=redis://localhost:6379`
  - `BROKER_STREAM=valuecanvas.events`
  - `BROKER_GROUP=valuecanvas-workers`
- Start a worker locally with the sample consumer in `src/services/messaging/SampleMessagingWorkflow.ts`.

## Deployment configuration
- Kubernetes manifests live in `kubernetes/messaging/redis-streams.yaml` and provision a Redis StatefulSet with PVC-backed storage plus an autoscaled `message-worker` Deployment.
- Workers rely on environment variables (`REDIS_URL`, `BROKER_STREAM`, `BROKER_GROUP`) and expose Prometheus annotations on port `9464` for queue metrics.
- DLQ messages land in `<stream>:dlq`; replay by piping entries back into the primary stream once the underlying issue is resolved.

## Operational considerations
- Set `maxDeliveries` and `idempotencyTtlMs` to balance retry aggressiveness against consumer side effects.
- Use deterministic `idempotencyKey` values from upstream systems (Stripe event IDs, export request hashes) so retries remain safe.
- Monitor Redis memory and disk for stream growth; prune or archive DLQ contents on a schedule.
