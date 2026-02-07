#!/usr/bin/env bash
set -euo pipefail

# Conservative migration of /src into /apps/ValyntApp/src
# - Moves non-conflicting items directly
# - Parks conflicts into apps/ValyntApp/src/legacy-migrated
# - Special-cases src/index.html to always park
# - Updates root tsconfig.json path aliases and include to point to app src

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$REPO_ROOT/src"
APP_DIR="$REPO_ROOT/apps/ValyntApp/src"
LEGACY="$APP_DIR/legacy-migrated"
TSROOT="$REPO_ROOT/tsconfig.json"

log() { printf "[migrate] %s\n" "$*"; }

log "Starting conservative migration: $SRC_DIR -> $APP_DIR"

if [ ! -d "$SRC_DIR" ]; then
  log "Source directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$LEGACY"

# Enable matching hidden entries and ignore empty globs
shopt -s dotglob nullglob

for item in "$SRC_DIR"/*; do
  name="$(basename "$item")"
  target="$APP_DIR/$name"

  # Special-case files that should not overwrite app structure
  if [ "$name" = "index.html" ]; then
    dest="$LEGACY/$name"; [ -e "$dest" ] && dest="$LEGACY/${name}.from-root"
    log "Parking special file $name -> $dest"
    mv "$item" "$dest"
    continue
  fi

  if [ -e "$target" ]; then
    dest="$LEGACY/$name"; [ -e "$dest" ] && dest="$LEGACY/${name}.from-root"
    log "Conflict for $name -> moving to $dest"
    mv "$item" "$dest"
  else
    log "Moving $name -> $APP_DIR/"
    mv "$item" "$APP_DIR/"
  fi

done

# Attempt to remove now-empty src directory (ignore if not empty)
rmdir "$SRC_DIR" 2>/dev/null || true

log "Move phase complete. Updating root tsconfig.json..."

if [ ! -f "$TSROOT" ]; then
  log "Root tsconfig.json not found: $TSROOT (skipping config update)"
  exit 0
fi

cp "$TSROOT" "$TSROOT.bak"

if command -v jq >/dev/null 2>&1; then
  # Update aliases that used to point to ./src to the new app path
  # and ensure include references apps/ValyntApp/src
  jq '
    .compilerOptions.paths["@/*"] = ["./apps/ValyntApp/src/*"] |
    .compilerOptions.paths["@lib/*"] = ["./apps/ValyntApp/src/lib/*"] |
    .compilerOptions.paths["@pages/*"] = ["./apps/ValyntApp/src/pages/*"] |
    .compilerOptions.paths["@layouts/*"] = ["./apps/ValyntApp/src/layouts/*"] |
    .compilerOptions.paths["@app/*"] = ["./apps/ValyntApp/src/app/*"] |
    (.include |= (((. // []) | map(if . == "./src" then "./apps/ValyntApp/src" else . end)) + ["./apps/ValyntApp/src"]) | unique)
  ' "$TSROOT.bak" > "$TSROOT.tmp" && mv "$TSROOT.tmp" "$TSROOT"
  log "Updated tsconfig.json using jq; backup saved at tsconfig.json.bak"
else
  # Fallback: conservative in-place edits using awk/sed
  # - Replace common src-based aliases to apps/ValyntApp/src
  # - Replace include ./src with apps/ValyntApp/src (and ensure it's present)
  tmpfile="$TSROOT.tmp"
  awk '
    BEGIN{RS="\n"; ORS="\n"}
    {
      gsub(/"@\\/\\*"\s*:\s*\[\s*"\.\\/src\\/\\*"\s*\]/, "\"@/*\": [\"./apps/ValyntApp/src/*\"]")
      gsub(/"@lib\\/\\*"\s*:\s*\[\s*"\.\\/src\\/lib\\/\\*"\s*\]/, "\"@lib/*\": [\"./apps/ValyntApp/src/lib/*\"]")
      gsub(/"@pages\\/\\*"\s*:\s*\[\s*"\.\\/src\\/pages\\/\\*"\s*\]/, "\"@pages/*\": [\"./apps/ValyntApp/src/pages/*\"]")
      gsub(/"@layouts\\/\\*"\s*:\s*\[\s*"\.\\/src\\/layouts\\/\\*"\s*\]/, "\"@layouts/*\": [\"./apps/ValyntApp/src/layouts/*\"]")
      gsub(/"@app\\/\\*"\s*:\s*\[\s*"\.\\/src\\/app\\/\\*"\s*\]/, "\"@app/*\": [\"./apps/ValyntApp/src/app/*\"]")
      gsub(/"\.\\/src"/, "\"./apps/ValyntApp/src\"")
      print
    }
  ' "$TSROOT.bak" > "$tmpfile"
  mv "$tmpfile" "$TSROOT"
  log "Updated tsconfig.json using awk; backup saved at tsconfig.json.bak"
fi

log "Conservative migration complete. Review:"
log "- App src: $APP_DIR"
log "- Parked conflicts: $LEGACY"
