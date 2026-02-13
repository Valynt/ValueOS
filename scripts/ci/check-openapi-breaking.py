#!/usr/bin/env python3
import argparse
import sys
import yaml


def load_spec(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} is not a valid OpenAPI object")
    return data


def compare(base: dict, head: dict):
    errors = []
    base_paths = base.get('paths', {}) or {}
    head_paths = head.get('paths', {}) or {}

    for path, base_ops in base_paths.items():
        if path not in head_paths:
            errors.append(f"Removed path: {path}")
            continue
        for method, base_op in (base_ops or {}).items():
            if method.startswith('x-'):
                continue
            head_op = (head_paths.get(path) or {}).get(method)
            if head_op is None:
                errors.append(f"Removed operation: {method.upper()} {path}")
                continue

            base_responses = (base_op or {}).get('responses', {}) or {}
            head_responses = (head_op or {}).get('responses', {}) or {}
            for status in base_responses.keys():
                if status not in head_responses:
                    errors.append(f"Removed response code {status} for {method.upper()} {path}")

            base_params = {(p.get('name'), p.get('in')): p for p in (base_op or {}).get('parameters', []) if isinstance(p, dict)}
            head_params = {(p.get('name'), p.get('in')): p for p in (head_op or {}).get('parameters', []) if isinstance(p, dict)}
            for key, p in base_params.items():
                if p.get('required') and key not in head_params:
                    errors.append(f"Removed required parameter {key[0]} ({key[1]}) for {method.upper()} {path}")

    return errors


def main():
    parser = argparse.ArgumentParser(description='Detect breaking OpenAPI changes.')
    parser.add_argument('--base', required=True)
    parser.add_argument('--head', required=True)
    args = parser.parse_args()

    try:
        base = load_spec(args.base)
        head = load_spec(args.head)
    except Exception as e:
        print(f"[openapi-break] Failed to load specs: {e}")
        return 2

    errors = compare(base, head)
    if errors:
        print('[openapi-break] Breaking changes detected:')
        for err in errors:
            print(f"  - {err}")
        return 1

    print('[openapi-break] No breaking changes detected.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
