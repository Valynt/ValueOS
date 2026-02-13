#!/usr/bin/env python3
import sys
from pathlib import Path
import yaml

ROOT = Path('infra/k8s')
SKIP_PARTS = {'overlays'}
WORKLOAD_KINDS = {'Deployment', 'StatefulSet', 'DaemonSet'}
MANAGED_PATH_SEGMENTS = ('/base/', '/cronjobs/')


def load_documents(path: Path):
    content = path.read_text(encoding='utf-8')
    for doc in yaml.safe_load_all(content):
        if isinstance(doc, dict):
            yield doc


def get_workload_spec(doc: dict):
    kind = doc.get('kind')
    spec = doc.get('spec', {}) or {}
    if kind == 'CronJob':
        template = (((spec.get('jobTemplate') or {}).get('spec') or {}).get('template') or {})
    else:
        template = spec.get('template') or {}
    pod_spec = template.get('spec') or {}
    containers = pod_spec.get('containers') or []
    return spec, pod_spec, containers


def main():
    if not ROOT.exists():
        print('[k8s-lint] infra/k8s directory not found')
        return 1

    errors = []
    hpa_targets = set()

    files = [p for p in ROOT.rglob('*') if p.suffix in {'.yaml', '.yml'} and not any(part in SKIP_PARTS for part in p.parts)]

    docs_by_file = []
    for file in files:
        try:
            docs = list(load_documents(file))
        except Exception as e:
            errors.append(f'{file}: invalid YAML ({e})')
            continue
        docs_by_file.append((file, docs))
        for doc in docs:
            if doc.get('kind') == 'HorizontalPodAutoscaler':
                target = (((doc.get('spec') or {}).get('scaleTargetRef') or {}).get('name'))
                if target:
                    hpa_targets.add(target)

    for file, docs in docs_by_file:
        for idx, doc in enumerate(docs, start=1):
            kind = doc.get('kind')
            if kind not in WORKLOAD_KINDS:
                continue

            normalized = str(file).replace('\\', '/')
            if not any(seg in normalized for seg in MANAGED_PATH_SEGMENTS):
                continue

            name = (doc.get('metadata') or {}).get('name', f'doc#{idx}')
            labels = (doc.get('metadata') or {}).get('labels') or {}
            if 'app.kubernetes.io/name' not in labels:
                errors.append(f'{file}:{name} missing metadata.labels.app.kubernetes.io/name')
            if 'app.kubernetes.io/part-of' not in labels:
                errors.append(f'{file}:{name} missing metadata.labels.app.kubernetes.io/part-of')

            spec, pod_spec, containers = get_workload_spec(doc)
            if not isinstance(pod_spec.get('securityContext'), dict):
                errors.append(f'{file}:{name} missing pod securityContext')

            if not containers:
                errors.append(f'{file}:{name} has no containers defined')
                continue

            for container in containers:
                cname = container.get('name', 'unnamed')
                if not container.get('livenessProbe'):
                    errors.append(f'{file}:{name}/{cname} missing livenessProbe')
                if not container.get('readinessProbe'):
                    errors.append(f'{file}:{name}/{cname} missing readinessProbe')
                if not isinstance(container.get('securityContext'), dict):
                    errors.append(f'{file}:{name}/{cname} missing container securityContext')

            annotations = (doc.get('metadata') or {}).get('annotations') or {}
            autoscaling_policy = annotations.get('autoscaling.valynt.io/policy')
            has_hpa = name in hpa_targets
            if autoscaling_policy not in {'horizontal', 'manual', 'disabled'} and not has_hpa:
                errors.append(
                    f'{file}:{name} missing autoscaling policy annotation '
                    '(autoscaling.valynt.io/policy=horizontal|manual|disabled) and no HPA target'
                )

    if errors:
        print('[k8s-lint] Architecture conformance errors:')
        for err in errors:
            print(f'  - {err}')
        return 1

    print('[k8s-lint] Kubernetes architecture conformance checks passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
