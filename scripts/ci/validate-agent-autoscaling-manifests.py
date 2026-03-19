#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / 'infra' / 'k8s' / 'base' / 'agents'
VALIDATION_NAMESPACE = 'valynt-agents'
LOW_FREQUENCY_AGENTS = {
    'benchmark-agent',
    'communicator-agent',
    'company-intelligence-agent',
    'coordinator-agent',
    'groundtruth-agent',
    'intervention-designer-agent',
    'narrative-agent',
    'outcome-engineer-agent',
    'system-mapper-agent',
    'value-eval-agent',
    'value-mapping-agent',
}
EXPECTED_FILE_BINDINGS = {
    'analysis-agents-hpa.yaml': {'financial-modeling-agent'},
    'core-lifecycle-hpa.yaml': {'target-agent', 'expansion-agent', 'integrity-agent'},
    'low-frequency-keda-scaledobjects.yaml': LOW_FREQUENCY_AGENTS,
    'remaining-agents-hpa-part2.yaml': {'research-agent'},
    'opportunity/hpa.yaml': {'opportunity-agent'},
    'realization/hpa.yaml': {'realization-agent'},
}
AUTOSCALING_PATTERNS = ('*hpa*.yaml', '*scaledobject*.yaml', '*scaledobjects*.yaml', '**/hpa.yaml')


class DuplicateKeySafeLoader(yaml.SafeLoader):
    pass


def _construct_mapping(loader: DuplicateKeySafeLoader, node: yaml.nodes.MappingNode, deep: bool = False) -> dict[str, Any]:
    mapping: dict[str, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError(
                'while constructing a mapping',
                node.start_mark,
                f'found duplicate key {key!r}',
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


DuplicateKeySafeLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_mapping,
)


def fail(message: str) -> None:
    print(f'❌ {message}', file=sys.stderr)
    sys.exit(1)


def discover_autoscaling_files() -> list[Path]:
    discovered: set[Path] = set()
    for pattern in AUTOSCALING_PATTERNS:
        discovered.update(AGENTS_DIR.glob(pattern))
    files = sorted(path for path in discovered if path.is_file() and path.name != 'autoscaling-template.yaml')
    if not files:
        fail('No autoscaling manifests were discovered under infra/k8s/base/agents/.')
    return files


def relative_manifest_path(path: Path) -> str:
    return path.relative_to(AGENTS_DIR).as_posix()


def load_yaml_documents(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open('r', encoding='utf-8') as handle:
            docs = [doc for doc in yaml.load_all(handle, Loader=DuplicateKeySafeLoader) if doc is not None]
    except yaml.YAMLError as exc:
        fail(f'{relative_manifest_path(path)} is malformed YAML or contains duplicate keys: {exc}')

    if not docs:
        fail(f'{relative_manifest_path(path)} does not contain any YAML documents.')

    for index, doc in enumerate(docs, start=1):
        if not isinstance(doc, dict):
            fail(f'{relative_manifest_path(path)} document #{index} must decode to a mapping/object.')
    return docs


def agent_type_for(deployment_name: str) -> str:
    return deployment_name.removesuffix('-agent')


def ensure_required_top_level_keys(doc: dict[str, Any], manifest_id: str) -> None:
    for key in ('apiVersion', 'kind', 'metadata', 'spec'):
        if key not in doc:
            fail(f'{manifest_id} is missing required top-level key {key!r}.')
    metadata = doc['metadata']
    if not isinstance(metadata, dict):
        fail(f'{manifest_id} metadata must be a mapping.')
    spec = doc['spec']
    if not isinstance(spec, dict):
        fail(f'{manifest_id} spec must be a mapping.')


def ensure_scale_target(doc: dict[str, Any], manifest_id: str) -> str:
    metadata_name = doc['metadata'].get('name')
    namespace = doc['metadata'].get('namespace')
    if not isinstance(metadata_name, str) or not metadata_name:
        fail(f'{manifest_id} metadata.name must be a non-empty string.')
    if namespace != VALIDATION_NAMESPACE:
        fail(f'{manifest_id} metadata.namespace must be {VALIDATION_NAMESPACE!r}.')

    scale_target = doc['spec'].get('scaleTargetRef')
    if not isinstance(scale_target, dict):
        fail(f'{manifest_id} spec.scaleTargetRef must be a mapping.')
    target_name = scale_target.get('name')
    if target_name != metadata_name:
        fail(f'{manifest_id} spec.scaleTargetRef.name must exactly match metadata.name ({metadata_name}).')
    return metadata_name


def validate_hpa(doc: dict[str, Any], manifest_id: str, deployment_name: str) -> None:
    if doc['apiVersion'] != 'autoscaling/v2':
        fail(f'{manifest_id} must use apiVersion autoscaling/v2.')
    if doc['kind'] != 'HorizontalPodAutoscaler':
        fail(f'{manifest_id} must use kind HorizontalPodAutoscaler.')
    if deployment_name in LOW_FREQUENCY_AGENTS:
        fail(f'{manifest_id} uses an HPA for low-frequency agent {deployment_name}; low-frequency agents must use KEDA ScaledObjects.')

    metrics = doc['spec'].get('metrics')
    if not isinstance(metrics, list) or not metrics:
        fail(f'{manifest_id} must declare at least one autoscaling metric.')

    external_metric = next((metric for metric in metrics if metric.get('type') == 'External'), None)
    if external_metric is None:
        fail(f'{manifest_id} must include an External metric based on the Prometheus adapter rule.')

    external = external_metric.get('external')
    if not isinstance(external, dict):
        fail(f'{manifest_id} external metric block must be a mapping.')
    metric = external.get('metric')
    if not isinstance(metric, dict):
        fail(f'{manifest_id} external.metric must be a mapping.')
    if metric.get('name') != 'agent_queue_depth':
        fail(f'{manifest_id} external.metric.name must be agent_queue_depth.')

    selector = metric.get('selector')
    if not isinstance(selector, dict):
        fail(f'{manifest_id} external.metric.selector must be a mapping.')
    match_labels = selector.get('matchLabels')
    if not isinstance(match_labels, dict):
        fail(f'{manifest_id} external.metric.selector.matchLabels must be a mapping.')

    expected_labels = {
        'queue': 'agent-tasks',
        'agent_type': agent_type_for(deployment_name),
    }
    if match_labels != expected_labels:
        fail(
            f'{manifest_id} external metric labels must exactly match {expected_labels}; found {match_labels}.',
        )


QUERY_CONSUMER_GROUP_RE = re.compile(r'consumer_group="([^"]+)"')
QUERY_STREAM_RE = re.compile(r'stream="([^"]+)"')


def validate_scaled_object(doc: dict[str, Any], manifest_id: str, deployment_name: str) -> None:
    if doc['apiVersion'] != 'keda.sh/v1alpha1':
        fail(f'{manifest_id} must use apiVersion keda.sh/v1alpha1.')
    if doc['kind'] != 'ScaledObject':
        fail(f'{manifest_id} must use kind ScaledObject.')
    if deployment_name not in LOW_FREQUENCY_AGENTS:
        fail(f'{manifest_id} uses KEDA for non-low-frequency agent {deployment_name}; only low-frequency agents should live in the KEDA manifest set.')

    labels = doc['metadata'].get('labels')
    if not isinstance(labels, dict) or labels.get('scaling.valueos.io/class') != 'low-frequency-queue':
        fail(f'{manifest_id} must declare scaling.valueos.io/class=low-frequency-queue.')

    if doc['spec'].get('minReplicaCount') != 0:
        fail(f'{manifest_id} must keep minReplicaCount at 0 for scale-to-zero behavior.')

    triggers = doc['spec'].get('triggers')
    if not isinstance(triggers, list) or not triggers:
        fail(f'{manifest_id} must declare at least one KEDA trigger.')

    trigger = triggers[0]
    if trigger.get('type') != 'prometheus':
        fail(f'{manifest_id} must use a Prometheus trigger.')
    metadata = trigger.get('metadata')
    if not isinstance(metadata, dict):
        fail(f'{manifest_id} trigger.metadata must be a mapping.')

    query = metadata.get('query')
    if not isinstance(query, str) or not query.strip():
        fail(f'{manifest_id} trigger.metadata.query must be a non-empty string.')

    consumer_group = QUERY_CONSUMER_GROUP_RE.search(query)
    stream_name = QUERY_STREAM_RE.search(query)
    expected_consumer_group = agent_type_for(deployment_name)

    if consumer_group is None or consumer_group.group(1) != expected_consumer_group:
        fail(
            f'{manifest_id} query consumer_group must match deployment-derived agent type {expected_consumer_group!r}.',
        )
    if stream_name is None or stream_name.group(1) != 'valuecanvas.events':
        fail(f'{manifest_id} query stream label must remain valuecanvas.events.')


def validate_expected_bindings(file_to_names: dict[str, set[str]]) -> None:
    discovered = set(file_to_names)
    expected = set(EXPECTED_FILE_BINDINGS)
    if discovered != expected:
        missing = sorted(expected - discovered)
        extra = sorted(discovered - expected)
        details = []
        if missing:
            details.append(f'missing expected autoscaling manifests: {missing}')
        if extra:
            details.append(f'unexpected autoscaling manifests discovered: {extra}')
        fail('; '.join(details))

    for relative_path, expected_names in EXPECTED_FILE_BINDINGS.items():
        if file_to_names[relative_path] != expected_names:
            fail(
                f'{relative_path} must contain exactly {sorted(expected_names)}; '
                f'found {sorted(file_to_names[relative_path])}.',
            )


def run_kustomize_build(manifest_path: Path) -> None:
    kustomize = shutil.which('kustomize')
    if not kustomize:
        fail('kustomize is required in PATH for autoscaling manifest validation.')

    with tempfile.TemporaryDirectory(prefix='autoscaling-kustomize-') as tmpdir:
        tmpdir_path = Path(tmpdir)
        kustomization = tmpdir_path / 'kustomization.yaml'
        kustomization.write_text(
            'apiVersion: kustomize.config.k8s.io/v1beta1\n'
            'kind: Kustomization\n'
            'resources:\n'
            f'  - {manifest_path}\n',
            encoding='utf-8',
        )
        result = subprocess.run(
            [kustomize, 'build', '--load-restrictor', 'LoadRestrictionsNone', str(tmpdir_path)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            fail(
                f'kustomize build failed for {relative_manifest_path(manifest_path)}:\n{result.stderr.strip() or result.stdout.strip()}',
            )


def run_kubeconform_if_available(manifest_path: Path) -> None:
    kubeconform = shutil.which('kubeconform')
    if not kubeconform:
        return

    result = subprocess.run(
        [kubeconform, '-strict', '-ignore-missing-schemas', str(manifest_path)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        fail(
            f'kubeconform validation failed for {relative_manifest_path(manifest_path)}:\n{result.stderr.strip() or result.stdout.strip()}',
        )


def main() -> None:
    autoscaling_files = discover_autoscaling_files()
    file_to_names: dict[str, set[str]] = {}
    kind_by_agent: dict[str, set[str]] = {}

    for path in autoscaling_files:
        relative_path = relative_manifest_path(path)
        docs = load_yaml_documents(path)
        names_in_file: set[str] = set()

        for index, doc in enumerate(docs, start=1):
            manifest_id = f'{relative_path} document #{index}'
            ensure_required_top_level_keys(doc, manifest_id)
            deployment_name = ensure_scale_target(doc, manifest_id)

            if deployment_name in names_in_file:
                fail(f'{manifest_id} duplicates deployment {deployment_name} within the same manifest file.')
            names_in_file.add(deployment_name)
            kind_by_agent.setdefault(deployment_name, set()).add(doc['kind'])

            if doc['kind'] == 'HorizontalPodAutoscaler':
                validate_hpa(doc, manifest_id, deployment_name)
            elif doc['kind'] == 'ScaledObject':
                validate_scaled_object(doc, manifest_id, deployment_name)
            else:
                fail(f'{manifest_id} has unsupported autoscaling kind {doc["kind"]!r}.')

        file_to_names[relative_path] = names_in_file
        run_kustomize_build(path)
        run_kubeconform_if_available(path)

    validate_expected_bindings(file_to_names)

    if kind_by_agent.get('financial-modeling-agent') != {'HorizontalPodAutoscaler'}:
        fail('financial-modeling-agent must remain a warm HorizontalPodAutoscaler workload.')

    for low_frequency_agent in LOW_FREQUENCY_AGENTS:
        if kind_by_agent.get(low_frequency_agent) != {'ScaledObject'}:
            fail(f'{low_frequency_agent} must be represented only as a KEDA ScaledObject.')

    print(f'✅ Validated {len(autoscaling_files)} autoscaling manifest files.')


if __name__ == '__main__':
    main()
