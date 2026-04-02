#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_PNPM="$ROOT_DIR/node_modules/.bin/pnpm"

if [[ ! -x "$ROOT_PNPM" ]]; then
  echo "root pnpm shim not found at $ROOT_PNPM" >&2
  exit 1
fi

while IFS= read -r pkg_json; do
  pkg_dir="$(dirname "$pkg_json")"
  bin_dir="$pkg_dir/node_modules/.bin"
  shim="$bin_dir/pnpm"

  if [[ -x "$shim" ]]; then
    continue
  fi

  mkdir -p "$bin_dir"
  ln -sf "$ROOT_PNPM" "$shim"
done < <(cd "$ROOT_DIR" && rg --files -g 'package.json' \
  | rg -v '(^|/)node_modules/' \
  | rg -v '^package.json$')
