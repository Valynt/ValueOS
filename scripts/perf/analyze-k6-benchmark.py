#!/usr/bin/env python3
"""Build benchmark artifacts from k6 output and correlate with infrastructure telemetry."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT_CAUSE_PRIORITY = ("CPU", "DB", "QUEUE", "CACHE_MISS")


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def metric_value(payload: dict, query: str, default: float = 0.0) -> float:
    try:
        result = payload.get("data", {}).get("result", [])
        if not result:
            return default
        return float(result[0]["value"][1])
    except (TypeError, ValueError, KeyError, IndexError):
        return default


def query_prometheus(prom_url: str, prom_token: str, query: str) -> float:
    params = urllib.parse.urlencode({"query": query})
    endpoint = f"{prom_url.rstrip('/')}/api/v1/query?{params}"
    request = urllib.request.Request(endpoint)
    if prom_token:
        request.add_header("Authorization", f"Bearer {prom_token}")
    with urllib.request.urlopen(request, timeout=15) as response:  # noqa: S310
        payload = json.loads(response.read().decode("utf-8"))
    return metric_value(payload, query)


def classify_root_cause(metrics: dict[str, float]) -> str:
    candidates: list[str] = []
    if metrics["cpu_usage_percent"] >= 85:
        candidates.append("CPU")
    if metrics["db_p95_seconds"] >= 0.2 or metrics["db_connections_utilization"] >= 0.8:
        candidates.append("DB")
    if metrics["queue_backlog"] >= 250:
        candidates.append("QUEUE")
    if metrics["cache_hit_ratio"] <= 0.9:
        candidates.append("CACHE_MISS")

    for label in ROOT_CAUSE_PRIORITY:
        if label in candidates:
            return label
    return "UNKNOWN"


def calc_burn_down(observed_p95_ms: float, target_p95_ms: float = 200.0) -> float:
    if observed_p95_ms <= 0:
        return 0.0
    if observed_p95_ms <= target_p95_ms:
        return 0.0
    return min(100.0, ((observed_p95_ms - target_p95_ms) / target_p95_ms) * 100.0)


def main() -> None:
    summary_path = Path(os.environ.get("K6_SUMMARY_PATH", "load-test-summary.json"))
    output_dir = Path(os.environ.get("BENCHMARK_OUTPUT_DIR", "benchmark-artifacts"))
    output_dir.mkdir(parents=True, exist_ok=True)

    run_summary = load_json(summary_path)

    commit_sha = os.environ.get("GITHUB_SHA", "unknown")
    release_ref = os.environ.get("GITHUB_REF_NAME", "unknown")
    run_id = os.environ.get("GITHUB_RUN_ID", "local")

    prom_url = os.environ.get("PROMETHEUS_URL", "")
    prom_token = os.environ.get("PROMETHEUS_TOKEN", "")

    infra_metrics = {
        "cpu_usage_percent": 0.0,
        "db_p95_seconds": 0.0,
        "db_connections_utilization": 0.0,
        "queue_backlog": 0.0,
        "cache_hit_ratio": 1.0,
    }

    if prom_url:
        infra_metrics["cpu_usage_percent"] = query_prometheus(
            prom_url,
            prom_token,
            "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
        )
        infra_metrics["db_p95_seconds"] = query_prometheus(
            prom_url,
            prom_token,
            "histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (le))",
        )
        infra_metrics["db_connections_utilization"] = query_prometheus(
            prom_url,
            prom_token,
            "avg(db_active_connections / clamp_min(db_max_connections, 1))",
        )
        infra_metrics["queue_backlog"] = query_prometheus(
            prom_url,
            prom_token,
            "sum(queue_jobs_waiting)",
        )
        infra_metrics["cache_hit_ratio"] = query_prometheus(
            prom_url,
            prom_token,
            "sum(rate(cache_hits_total[5m])) / clamp_min(sum(rate(cache_requests_total[5m])), 1)",
        )

    latency_ms = run_summary.get("latency_ms", {})
    interactive_p95 = float(latency_ms.get("interactive_completion_p95") or 0)
    orchestration_ack_p95 = float(latency_ms.get("orchestration_acknowledgment_p95") or 0)
    orchestration_completion_p95 = float(latency_ms.get("orchestration_completion_p95") or 0)

    root_cause = classify_root_cause(infra_metrics)

    benchmark_record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "commit_sha": commit_sha,
        "release_ref": release_ref,
        "latency_ms": run_summary.get("latency_ms", {}),
        "error_rate": run_summary.get("error_rate", 0),
        "rps": run_summary.get("rps", 0),
        "saturation": run_summary.get("saturation", {}),
        "interactive_completion_guard": {
            "target_p95_ms": 200,
            "observed_p95_ms": interactive_p95,
            "passed": interactive_p95 <= 200,
            "window": "sustained",
        },
        "orchestration_acknowledgment_guard": {
            "target_p95_ms": 200,
            "observed_p95_ms": orchestration_ack_p95,
            "passed": orchestration_ack_p95 <= 200,
            "window": "sustained",
        },
        "orchestration_completion_exception_guard": {
            "target_p95_ms": 3000,
            "observed_p95_ms": orchestration_completion_p95,
            "passed": orchestration_completion_p95 <= 3000,
            "window": "sustained",
        },
        "latency_budget": {
            "target_p95_ms": 200,
            "observed_p95_ms": interactive_p95,
            "burn_down_percent": calc_burn_down(interactive_p95),
            "remaining_percent": max(0.0, 100.0 - calc_burn_down(interactive_p95)),
        },
        "infra_correlation": {
            "root_cause": root_cause,
            "metrics": infra_metrics,
        },
    }

    summary_file = output_dir / "benchmark-summary.json"
    summary_file.write_text(json.dumps(benchmark_record, indent=2), encoding="utf-8")

    report_file = output_dir / "benchmark-report.md"
    report_file.write_text(
        "\n".join(
            [
                "# Staging Benchmark Report",
                "",
                f"- Commit: `{commit_sha}`",
                f"- Release ref: `{release_ref}`",
                f"- Run ID: `{run_id}`",
                "",
                "## Request Performance",
                f"- Interactive completion p95: {interactive_p95}",
                f"- Orchestration acknowledgment p95: {orchestration_ack_p95}",
                f"- Orchestration completion p95: {orchestration_completion_p95}",
                f"- Error rate: {benchmark_record['error_rate']}",
                f"- RPS: {benchmark_record['rps']}",
                "",
                "## Saturation",
                f"- Max VUs: {benchmark_record['saturation'].get('vus_max')}",
                f"- Dropped iterations: {benchmark_record['saturation'].get('dropped_iterations')}",
                f"- Blocked p95 (ms): {benchmark_record['saturation'].get('blocked_p95_ms')}",
                "",
                "## Promotion Guard",
                f"- Interactive completion target: <= 200ms (observed {interactive_p95})",
                f"- Interactive completion gate: {'PASS' if benchmark_record['interactive_completion_guard']['passed'] else 'FAIL'}",
                f"- Orchestration acknowledgment target: <= 200ms (observed {orchestration_ack_p95})",
                f"- Orchestration acknowledgment gate: {'PASS' if benchmark_record['orchestration_acknowledgment_guard']['passed'] else 'FAIL'}",
                f"- Orchestration completion exception: <= 3000ms (observed {orchestration_completion_p95})",
                f"- Orchestration completion exception gate: {'PASS' if benchmark_record['orchestration_completion_exception_guard']['passed'] else 'FAIL'}",
                "",
                "## Root-cause Auto-Tag",
                f"- Category: **{root_cause}**",
                f"- CPU usage (%): {infra_metrics['cpu_usage_percent']:.2f}",
                f"- DB p95 (s): {infra_metrics['db_p95_seconds']:.3f}",
                f"- DB connections utilization: {infra_metrics['db_connections_utilization']:.3f}",
                f"- Queue backlog: {infra_metrics['queue_backlog']:.2f}",
                f"- Cache hit ratio: {infra_metrics['cache_hit_ratio']:.3f}",
                "",
                "## Latency Budget Burn-down",
                f"- Burn down: {benchmark_record['latency_budget']['burn_down_percent']:.2f}%",
                f"- Remaining budget: {benchmark_record['latency_budget']['remaining_percent']:.2f}%",
            ]
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
