#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_PNPM="$ROOT_DIR/node_modules/.bin/pnpm"
ROOT_PNPM_CJS="$ROOT_DIR/node_modules/pnpm/bin/pnpm.cjs"

if [[ ! -x "$ROOT_PNPM" ]]; then
  echo "root pnpm shim not found at $ROOT_PNPM" >&2
  exit 1
fi

if [[ ! -f "$ROOT_PNPM_CJS" ]]; then
  echo "root pnpm entrypoint not found at $ROOT_PNPM_CJS" >&2
  exit 1
fi

# Enumerate only the package locations declared by pnpm-workspace.yaml.
# Shell globbing works both in checkouts and in Docker build stages without .git
# metadata or ripgrep; all expected directory shapes are explicit here.
manifest_count=0
for pkg_json in \
  "$ROOT_DIR"/packages/*/package.json \
  "$ROOT_DIR"/packages/services/*/package.json \
  "$ROOT_DIR"/packages/mcp/{ground-truth,crm,common}/package.json \
  "$ROOT_DIR"/apps/*/package.json \
  "$ROOT_DIR"/apps/*/packages/*/package.json; do
  [[ -f "$pkg_json" ]] || continue
  pkg_dir="$(dirname "$pkg_json")"
  bin_dir="$pkg_dir/node_modules/.bin"
  shim="$bin_dir/pnpm"

  mkdir -p "$bin_dir"
  cat > "$shim" <<SHIM
#!/usr/bin/env bash
exec node "$ROOT_PNPM_CJS" "\$@"
SHIM
  chmod +x "$shim"
  manifest_count=$((manifest_count + 1))
done

if (( manifest_count == 0 )); then
  echo "no package manifests found in pnpm-workspace.yaml locations" >&2
  exit 1
fi
