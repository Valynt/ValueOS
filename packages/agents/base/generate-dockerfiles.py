#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
AGENTS_DIR = BASE_DIR.parent
TEMPLATE_PATH = BASE_DIR / "Dockerfile.template"


def main() -> None:
    template = TEMPLATE_PATH.read_text()
    for agent_dir in AGENTS_DIR.iterdir():
        if not agent_dir.is_dir():
            continue
        if agent_dir.name in {"base", "node_modules"}:
            continue
        if not (agent_dir / "package.json").exists():
            continue
        dockerfile_path = agent_dir / "Dockerfile"
        content = template.replace(
            "ARG AGENT_NAME\n", f"ARG AGENT_NAME={agent_dir.name}\n", 1
        )
        dockerfile_path.write_text(content)


if __name__ == "__main__":
    main()
