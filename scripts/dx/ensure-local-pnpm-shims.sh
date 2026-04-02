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

while IFS= read -r pkg_json; do
  pkg_dir="$(dirname "$pkg_json")"
  bin_dir="$pkg_dir/node_modules/.bin"
  shim="$bin_dir/pnpm"

  mkdir -p "$bin_dir"
  cat > "$shim" <<SHIM
#!/usr/bin/env bash
exec node "$ROOT_PNPM_CJS" "\$@"
SHIM
  chmod +x "$shim"
done < <(cd "$ROOT_DIR" && rg --files -g 'package.json' \
  | rg -v '(^|/)node_modules/' \
  | rg -v '^package.json$')
