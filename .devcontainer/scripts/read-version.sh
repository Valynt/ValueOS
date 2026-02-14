#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <tool-name>" >&2
  exit 1
fi

TOOL_NAME="$1"
VERSIONS_FILE="${VERSIONS_FILE:-pragmatic-reproducibility/ci/versions.json}"

if [ ! -f "$VERSIONS_FILE" ]; then
  echo "Versions file not found: $VERSIONS_FILE" >&2
  exit 1
fi

node -e '
const fs = require("fs");
const file = process.argv[1];
const key = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Object.prototype.hasOwnProperty.call(data, key)) {
  console.error(`Missing version for ${key} in ${file}`);
  process.exit(1);
}
process.stdout.write(String(data[key]));
' "$VERSIONS_FILE" "$TOOL_NAME"
