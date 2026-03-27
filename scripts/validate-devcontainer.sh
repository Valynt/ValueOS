#!/bin/bash
# Failsafe: Validate devcontainer.json before build
# Usage: ./scripts/validate-devcontainer.sh

set -euo pipefail

CONFIG="${1:-.devcontainer/devcontainer.json}"

# Check file exists
if [[ ! -f "$CONFIG" ]]; then
    echo "❌ devcontainer.json not found at $CONFIG"
    exit 1
fi

# Remove comments (// and /* */) and validate JSON
if ! node -e "
const fs = require('fs');
const content = fs.readFileSync('$CONFIG', 'utf8');
// Strip single-line comments
let clean = content.replace(/\\/\\/.*/g, '');
// Strip multi-line comments
clean = clean.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
try {
    JSON.parse(clean);
    console.log('✓ devcontainer.json is valid JSON');
} catch (e) {
    console.error('❌ JSON parse error:', e.message);
    process.exit(1);
}
"; then
    echo "❌ Validation failed"
    exit 1
fi

# Check schema URL is present
if ! grep -q '"\$schema"' "$CONFIG"; then
    echo "⚠️  Warning: No \$schema reference found for IDE validation"
fi

echo "✅ devcontainer.json is valid and ready"
