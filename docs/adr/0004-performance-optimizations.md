# ADR 0004: Performance Optimization Trade-offs

- **Status**: Accepted
- **Date**: 2025-11-17
- **Scope**: Runtime performance improvements across Agent Fabric, SDUI rendering, and Supabase interactions.

## Context
The platform must keep interactive latency low while orchestrating multi-agent workflows and rendering SDUI payloads. Several optimizations are available, but each introduces operational or architectural trade-offs.

## Decision
- Enable **response caching** for read-mostly endpoints and SDUI manifests with short TTLs; bypass cache for authenticated mutations.
- Use **batching and concurrency controls** in the Task Router to minimize LLM round-trips while respecting provider rate limits.
- Adopt **lazy-loading** for non-critical SDUI components and documentation assets to prioritize above-the-fold rendering.
- Apply **vector index tuning** (e.g., `ivfflat` parameters) only after capturing baseline metrics; keep fallbacks to sequential scans for correctness.
- Collect **runtime telemetry** (latency, token counts, cache hit rate) and feed it into SLO dashboards to inform further tuning.

## Alternatives Considered
- **Aggressive client-side caching of all SDUI payloads**: Rejected to avoid serving stale governance-sensitive manifests.
- **Unbounded parallelism in the orchestrator**: Rejected due to LLM provider throttling and risk of race conditions in shared state.

## Consequences
- Caching layers require explicit invalidation hooks during releases and rollbacks (see runbook cache steps).
- Batching improves throughput but can delay individual tasks; concurrency settings must be revisited after incident reviews.
- Lazy-loading reduces initial payload size but requires careful skeleton states to preserve perceived performance.
- Telemetry collection introduces slight overhead but is necessary for data-driven optimizations.
