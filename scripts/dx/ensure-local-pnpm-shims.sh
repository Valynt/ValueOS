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

# Use Git's tracked manifest inventory rather than ripgrep: minimal CI images
# need not install rg, and only checked-in workspaces should receive shims.
# NUL delimiting avoids misparsing whitespace in manifest paths.
while IFS= read -r -d '' pkg_json; do
  [[ "$pkg_json" == "package.json" ]] && continue
  pkg_dir="$(dirname "$pkg_json")"
  bin_dir="$ROOT_DIR/$pkg_dir/node_modules/.bin"
  shim="$bin_dir/pnpm"

  mkdir -p "$bin_dir"
  cat > "$shim" <<SHIM
#!/usr/bin/env bash
exec node "$ROOT_PNPM_CJS" "\$@"
SHIM
  chmod +x "$shim"
done < <(cd "$ROOT_DIR" && git ls-files -z -- ':(glob)**/package.json')
