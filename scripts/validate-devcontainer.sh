#!/bin/bash
# Fail-closed validation of the checked-in devcontainer configuration.
# The project uses strict JSON, not JSONC; never strip // from URL strings.
set -euo pipefail

CONFIG="${1:-.devcontainer/devcontainer.json}"

if [[ ! -f "$CONFIG" ]]; then
    echo "ERROR: devcontainer.json not found at $CONFIG" >&2
    exit 1
fi

if ! node - "$CONFIG" <<'NODE'
const fs = require('node:fs');
try {
  JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log('devcontainer.json is valid strict JSON');
} catch (error) {
  console.error('ERROR: devcontainer JSON parse failed:', error.message);
  process.exit(1);
}
NODE
then
    echo "ERROR: devcontainer validation failed" >&2
    exit 1
fi

if ! grep -Fq '"$schema"' "$CONFIG"; then
    echo 'WARNING: devcontainer.json has no $schema reference' >&2
fi

echo "devcontainer.json is valid and ready"
