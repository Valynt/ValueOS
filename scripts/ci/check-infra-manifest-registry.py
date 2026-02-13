#!/usr/bin/env python3
import re
import subprocess
import sys
from pathlib import Path

README = Path('infra/README.md')


def parse_registry(text: str):
    section_match = re.search(r"## Active vs Deprecated Infra Manifest Registry\n(.*?)(?:\n## |\Z)", text, re.S)
    if not section_match:
        raise ValueError('Missing "Active vs Deprecated Infra Manifest Registry" section in infra/README.md')

    rows = []
    for line in section_match.group(1).splitlines():
        if not line.strip().startswith('|'):
            continue
        cols = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cols) < 4 or cols[0] in {'Type', '---'}:
            continue
        rows.append(cols)
    return rows


def main():
    if not README.exists():
        print('[infra-registry] infra/README.md not found')
        return 1

    text = README.read_text(encoding='utf-8')
    try:
        rows = parse_registry(text)
    except ValueError as e:
        print(f'[infra-registry] {e}')
        return 1

    if not rows:
        print('[infra-registry] Registry is empty')
        return 1

    deprecated = []
    missing = []
    for row in rows:
        _, path, lifecycle, *_ = row + [''] * (4 - len(row))
        manifest_path = path.strip('`')
        lifecycle = lifecycle.lower()
        if lifecycle == 'deprecated':
            deprecated.append(manifest_path)
        if lifecycle == 'active' and not Path(manifest_path).exists():
            missing.append(manifest_path)

    if missing:
        print('[infra-registry] Active entries that do not exist:')
        for m in missing:
            print(f'  - {m}')
        return 1

    offenders = []
    for dep in deprecated:
        cmd = [
            'rg', '--line-number', '--fixed-strings', dep,
            '--glob', '!.git/**',
            '--glob', '!infra/README.md',
            '--glob', '!scripts/ci/check-infra-manifest-registry.py',
            '.'
        ]
        result = subprocess.run(cmd, text=True, capture_output=True)
        if result.returncode == 0 and result.stdout.strip():
            offenders.append((dep, result.stdout.strip().splitlines()))

    if offenders:
        print('[infra-registry] Deprecated manifest paths are still referenced:')
        for dep, lines in offenders:
            print(f'  - {dep}')
            for line in lines[:5]:
                print(f'    {line}')
        return 1

    print('[infra-registry] Registry is valid and no deprecated paths are referenced.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
