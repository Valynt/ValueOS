#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
import tempfile
from typing import Any

import yaml


class UniqueKeyLoader(yaml.SafeLoader):
    pass


def construct_mapping(loader: yaml.SafeLoader, node: yaml.nodes.MappingNode, deep: bool = False) -> dict[str, Any]:
    mapping: dict[str, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"found duplicate key ({key})",
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_yaml_documents(path: pathlib.Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    try:
        documents = [doc for doc in yaml.load_all(text, Loader=UniqueKeyLoader) if doc is not None]
    except yaml.YAMLError as exc:
        fail(f"{path}: invalid YAML ({exc})")
    if not documents:
        fail(f"{path}: expected at least one YAML document")
    return documents


def load_strategy(agents_dir: pathlib.Path) -> dict[str, dict[str, str]]:
    strategy_path = agents_dir / "SCALING-STRATEGY.md"
    strategy: dict[str, dict[str, str]] = {}
    for raw_line in strategy_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) != 5 or parts[0] in {"Agent", "---"}:
            continue
        agent, scaling_class, baseline, mechanism, notes = parts
        strategy[agent] = {
            "scaling_class": scaling_class,
            "baseline": baseline,
            "mechanism": mechanism,
            "notes": notes,
        }
    if not strategy:
        fail(f"{strategy_path}: could not parse scaling strategy table")
    return strategy


def load_deployments(agents_dir: pathlib.Path) -> set[str]:
    deployments: set[str] = set()
    for deployment_path in sorted(agents_dir.glob("*/deployment.yaml")):
        docs = load_yaml_documents(deployment_path)
        for doc in docs:
            if doc.get("kind") == "Deployment":
                metadata = doc.get("metadata") or {}
                name = metadata.get("name")
                if name:
                    deployments.add(str(name))
    if not deployments:
        fail("No deployment manifests discovered for agent autoscaling validation")
    return deployments


def load_adapter_metric_name(agents_dir: pathlib.Path) -> str:
    adapter_path = agents_dir / "prometheus-adapter-rules.yaml"
    docs = load_yaml_documents(adapter_path)
    config_map = docs[0]
    raw_rules = ((config_map.get("data") or {}).get("agent-rules.yaml"))
    if not isinstance(raw_rules, str):
        fail(f"{adapter_path}: missing data.agent-rules.yaml")
    match = re.search(r'as:\s*"([^"]+)"', raw_rules)
    if not match:
        fail(f"{adapter_path}: unable to determine exposed external metric name")
    return match.group(1)


def discover_autoscaling_files(agents_dir: pathlib.Path) -> list[pathlib.Path]:
    files = sorted(
        {
            *agents_dir.glob("*hpa*.yaml"),
            *agents_dir.glob("*scaledobject*.yaml"),
            *agents_dir.glob("*/hpa.yaml"),
        }
    )
    if not files:
        fail(f"{agents_dir}: no autoscaling manifests found")
    return files


def run_kustomize_build(kustomize_bin: str, manifest_path: pathlib.Path) -> list[dict[str, Any]]:
    with tempfile.TemporaryDirectory(prefix="agent-autoscaling-", dir=manifest_path.parent) as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        kustomization_path = tmp_path / "kustomization.yaml"
        kustomization_path.write_text(
            "\n".join(
                [
                    "apiVersion: kustomize.config.k8s.io/v1beta1",
                    "kind: Kustomization",
                    "resources:",
                    f"  - ../{manifest_path.name}" if manifest_path.parent == tmp_path.parent else f"  - ../{manifest_path.parent.name}/{manifest_path.name}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        result = subprocess.run(
            [kustomize_bin, "build", "--load-restrictor=LoadRestrictionsNone", str(tmp_path)],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            fail(f"{manifest_path}: kustomize build failed\n{result.stderr.strip()}")
        try:
            documents = [doc for doc in yaml.load_all(result.stdout, Loader=UniqueKeyLoader) if doc is not None]
        except yaml.YAMLError as exc:
            fail(f"{manifest_path}: built output is invalid YAML ({exc})")
        if not documents:
            fail(f"{manifest_path}: kustomize build produced no documents")
        return documents


def run_kustomize_directory(kustomize_bin: str, directory_path: pathlib.Path) -> list[dict[str, Any]]:
    result = subprocess.run(
        [kustomize_bin, "build", "--load-restrictor=LoadRestrictionsNone", str(directory_path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        fail(f"{directory_path}: kustomize build failed\n{result.stderr.strip()}")
    try:
        documents = [doc for doc in yaml.load_all(result.stdout, Loader=UniqueKeyLoader) if doc is not None]
    except yaml.YAMLError as exc:
        fail(f"{directory_path}: built output is invalid YAML ({exc})")
    if not documents:
        fail(f"{directory_path}: kustomize build produced no documents")
    return documents


def expect(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def validate_hpa(
    file_path: pathlib.Path,
    doc: dict[str, Any],
    strategy: dict[str, dict[str, str]],
    deployment_names: set[str],
    adapter_metric_name: str,
    seen_hpas: set[str],
) -> None:
    metadata = doc.get("metadata") or {}
    spec = doc.get("spec") or {}
    name = metadata.get("name")
    expect(isinstance(name, str), f"{file_path}: HPA metadata.name must be set")
    expect(doc.get("apiVersion") == "autoscaling/v2", f"{file_path}: {name} must use apiVersion autoscaling/v2")
    expect(doc.get("kind") == "HorizontalPodAutoscaler", f"{file_path}: {name} must use kind HorizontalPodAutoscaler")
    expect(metadata.get("namespace") == "valynt-agents", f"{file_path}: {name} must target namespace valynt-agents")
    expect(name in strategy, f"{file_path}: {name} is not declared in SCALING-STRATEGY.md")
    expect(
        strategy[name]["scaling_class"] != "low-frequency queue",
        f"{file_path}: {name} is low-frequency and must be a KEDA ScaledObject, not an HPA",
    )
    scale_target = spec.get("scaleTargetRef") or {}
    expect(scale_target.get("apiVersion") == "apps/v1", f"{file_path}: {name} scaleTargetRef.apiVersion must be apps/v1")
    expect(scale_target.get("kind") == "Deployment", f"{file_path}: {name} scaleTargetRef.kind must be Deployment")
    expect(scale_target.get("name") == name, f"{file_path}: {name} scaleTargetRef.name must match metadata.name")
    expect(name in deployment_names, f"{file_path}: {name} does not match any deployment manifest name")

    baseline = int(strategy[name]["baseline"])
    min_replicas = spec.get("minReplicas")
    expect(isinstance(min_replicas, int), f"{file_path}: {name} spec.minReplicas must be an integer")
    expect(min_replicas == baseline, f"{file_path}: {name} minReplicas {min_replicas} must match strategy baseline {baseline}")
    expect(isinstance(spec.get("maxReplicas"), int), f"{file_path}: {name} spec.maxReplicas must be an integer")

    metrics = spec.get("metrics")
    expect(isinstance(metrics, list) and metrics, f"{file_path}: {name} spec.metrics must be a non-empty list")
    external_metrics = [metric for metric in metrics if metric.get("type") == "External"]
    expect(external_metrics, f"{file_path}: {name} must declare an External metric")
    external_metric = external_metrics[0].get("external") or {}
    metric = external_metric.get("metric") or {}
    selector = metric.get("selector") or {}
    match_labels = selector.get("matchLabels") or {}
    agent_type = name.removesuffix("-agent")
    expect(metric.get("name") == adapter_metric_name, f"{file_path}: {name} external metric must use adapter metric {adapter_metric_name}")
    expect(match_labels.get("queue") == "agent-tasks", f"{file_path}: {name} external metric queue label must be agent-tasks")
    expect(match_labels.get("agent_type") == agent_type, f"{file_path}: {name} external metric agent_type must be {agent_type}")

    seen_hpas.add(name)


def validate_scaled_object(
    file_path: pathlib.Path,
    doc: dict[str, Any],
    strategy: dict[str, dict[str, str]],
    deployment_names: set[str],
    seen_scaled_objects: set[str],
) -> None:
    metadata = doc.get("metadata") or {}
    spec = doc.get("spec") or {}
    name = metadata.get("name")
    expect(isinstance(name, str), f"{file_path}: ScaledObject metadata.name must be set")
    expect(doc.get("apiVersion") == "keda.sh/v1alpha1", f"{file_path}: {name} must use apiVersion keda.sh/v1alpha1")
    expect(doc.get("kind") == "ScaledObject", f"{file_path}: {name} must use kind ScaledObject")
    expect(metadata.get("namespace") == "valynt-agents", f"{file_path}: {name} must target namespace valynt-agents")
    expect(name in strategy, f"{file_path}: {name} is not declared in SCALING-STRATEGY.md")
    expect(
        strategy[name]["scaling_class"] == "low-frequency queue",
        f"{file_path}: {name} must remain in the low-frequency KEDA class",
    )
    expect(strategy[name]["baseline"] == "0", f"{file_path}: {name} low-frequency baseline must remain 0")

    scale_target = spec.get("scaleTargetRef") or {}
    expect(scale_target.get("apiVersion") == "apps/v1", f"{file_path}: {name} scaleTargetRef.apiVersion must be apps/v1")
    expect(scale_target.get("kind") == "Deployment", f"{file_path}: {name} scaleTargetRef.kind must be Deployment")
    expect(scale_target.get("name") == name, f"{file_path}: {name} scaleTargetRef.name must match metadata.name")
    expect(name in deployment_names, f"{file_path}: {name} does not match any deployment manifest name")

    expect(spec.get("minReplicaCount") == 0, f"{file_path}: {name} minReplicaCount must be 0 for scale-to-zero")
    expect(spec.get("pollingInterval") == 15, f"{file_path}: {name} pollingInterval must be 15 seconds")
    expect(spec.get("cooldownPeriod") == 180, f"{file_path}: {name} cooldownPeriod must be 180 seconds")
    expect(isinstance(spec.get("maxReplicaCount"), int), f"{file_path}: {name} maxReplicaCount must be an integer")

    triggers = spec.get("triggers")
    expect(isinstance(triggers, list) and triggers, f"{file_path}: {name} must declare at least one KEDA trigger")
    trigger = triggers[0]
    expect(trigger.get("type") == "prometheus", f"{file_path}: {name} trigger.type must be prometheus")
    trigger_metadata = trigger.get("metadata") or {}
    agent_slug = name.removesuffix("-agent")
    metric_name = trigger_metadata.get("metricName")
    expected_metric_name = f"{agent_slug.replace('-', '_')}_redis_stream_depth"
    expect(metric_name == expected_metric_name, f"{file_path}: {name} metricName must be {expected_metric_name}")
    expect(trigger_metadata.get("threshold") == "1", f"{file_path}: {name} threshold must remain '1'")
    expect(trigger_metadata.get("activationThreshold") == "1", f"{file_path}: {name} activationThreshold must remain '1'")
    query = trigger_metadata.get("query")
    expect(isinstance(query, str), f"{file_path}: {name} query must be a string")
    expect("redis_stream_length" in query, f"{file_path}: {name} query must use redis_stream_length")
    expect(
        f'consumer_group="{agent_slug}"' in query,
        f"{file_path}: {name} query consumer_group must match deployment slug {agent_slug}",
    )

    seen_scaled_objects.add(name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--kustomize", required=True)
    args = parser.parse_args()

    repo_root = pathlib.Path(args.repo_root).resolve()
    agents_dir = repo_root / "infra/k8s/base/agents"
    strategy = load_strategy(agents_dir)
    deployment_names = load_deployments(agents_dir)
    adapter_metric_name = load_adapter_metric_name(agents_dir)
    autoscaling_files = discover_autoscaling_files(agents_dir)

    seen_hpas: set[str] = set()
    seen_scaled_objects: set[str] = set()

    for autoscaling_file in autoscaling_files:
        load_yaml_documents(autoscaling_file)
        built_docs = run_kustomize_build(args.kustomize, autoscaling_file)
        for doc in built_docs:
            kind = doc.get("kind")
            if kind == "HorizontalPodAutoscaler":
                validate_hpa(autoscaling_file, doc, strategy, deployment_names, adapter_metric_name, seen_hpas)
            elif kind == "ScaledObject":
                validate_scaled_object(autoscaling_file, doc, strategy, deployment_names, seen_scaled_objects)
            else:
                fail(f"{autoscaling_file}: unsupported autoscaling kind {kind}")

    run_kustomize_directory(args.kustomize, agents_dir)

    expected_low_frequency = {name for name, data in strategy.items() if data["scaling_class"] == "low-frequency queue"}
    expect(
        seen_scaled_objects == expected_low_frequency,
        "Low-frequency ScaledObjects do not exactly match SCALING-STRATEGY.md\n"
        f"  expected: {sorted(expected_low_frequency)}\n"
        f"  found: {sorted(seen_scaled_objects)}",
    )

    invalid_hpas = sorted(name for name in seen_hpas if strategy[name]["scaling_class"] == "low-frequency queue")
    expect(not invalid_hpas, f"Low-frequency agents incorrectly present as HPAs: {invalid_hpas}")

    print(
        f"Validated {len(autoscaling_files)} autoscaling files, "
        f"{len(seen_hpas) + len(seen_scaled_objects)} autoscaler resources, and the full agents kustomization."
    )


if __name__ == "__main__":
    main()
