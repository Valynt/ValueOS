#!/usr/bin/env bash
# scripts/sync-tool-versions.sh
# Ensures all version sources stay synchronized with .tool-versions
#
# Usage:
#   ./scripts/sync-tool-versions.sh          # Sync all targets
#   ./scripts/sync-tool-versions.sh --check  # Check only, no modifications

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOL_VERSIONS="$REPO_ROOT/.tool-versions"
CHECK_ONLY=false

for arg in "$@"; do
    case $arg in
        --check|-c) CHECK_ONLY=true ;;
    esac
done

if [[ ! -f "$TOOL_VERSIONS" ]]; then
    echo "❌ .tool-versions not found at $TOOL_VERSIONS"
    exit 1
fi

# Parse .tool-versions into associative array
declare -A VERSIONS
while IFS=' ' read -r tool version; do
    [[ "$tool" =~ ^#.*$ || -z "$tool" ]] && continue
    VERSIONS[$tool]="$version"
done < "$TOOL_VERSIONS"

echo "📦 Parsed versions from .tool-versions:"
for tool in "${!VERSIONS[@]}"; do
    printf "   %-15s %s\n" "$tool:" "${VERSIONS[$tool]}"
done
echo ""

CHANGES_NEEDED=false

# ─────────────────────────────────────────────────────────────────────────────
# Update Dockerfile.optimized ARGs
# ─────────────────────────────────────────────────────────────────────────────
update_dockerfile() {
    local dockerfile="$REPO_ROOT/.devcontainer/Dockerfile.optimized"

    if [[ ! -f "$dockerfile" ]]; then
        echo "⚠️  Dockerfile.optimized not found, skipping"
        return
    fi

    echo "🐳 Checking Dockerfile.optimized..."

    local temp_file=$(mktemp)
    local modified=false

    while IFS= read -r line; do
        if [[ "$line" =~ ^ARG[[:space:]]+([A-Z_]+)_VERSION=(.*)$ ]]; then
            local tool_upper="${BASH_REMATCH[1]}"
            local current_value="${BASH_REMATCH[2]}"
            local tool_lower=$(echo "$tool_upper" | tr '[:upper:]' '[:lower:]')

            case "$tool_lower" in
                node) tool_lower="nodejs" ;;
            esac

            if [[ -n "${VERSIONS[$tool_lower]:-}" ]]; then
                local new_value="${VERSIONS[$tool_lower]}"
                current_value="${current_value//\"/}"

                if [[ "$current_value" != "$new_value" ]]; then
                    echo "   📝 ${tool_upper}_VERSION: $current_value → $new_value"
                    echo "ARG ${tool_upper}_VERSION=\"${new_value}\"" >> "$temp_file"
                    modified=true
                    CHANGES_NEEDED=true
                else
                    echo "$line" >> "$temp_file"
                fi
            else
                echo "$line" >> "$temp_file"
            fi
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$dockerfile"

    if [[ "$modified" == "true" ]]; then
        if [[ "$CHECK_ONLY" == "true" ]]; then
            echo "   ⚠️  Changes needed (check mode)"
        else
            mv "$temp_file" "$dockerfile"
            echo "   ✓ Updated"
        fi
    else
        echo "   ✓ Already in sync"
        rm -f "$temp_file"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Update devcontainer.json features
# ─────────────────────────────────────────────────────────────────────────────
update_devcontainer() {
    local devcontainer="$REPO_ROOT/.devcontainer/devcontainer.json"

    if [[ ! -f "$devcontainer" ]]; then
        echo "⚠️  devcontainer.json not found, skipping"
        return
    fi

    if ! command -v jq &>/dev/null; then
        echo "⚠️  jq not found, skipping devcontainer.json update"
        return
    fi

    echo "📦 Checking devcontainer.json..."

    local temp_file=$(mktemp)

    # Extract major version for features (they use major.minor format)
    local node_major=$(echo "${VERSIONS[nodejs]:-22}" | cut -d. -f1)
    local python_version=$(echo "${VERSIONS[python]:-3.11}" | cut -d. -f1,2)
    local go_version=$(echo "${VERSIONS[go]:-1.21}" | cut -d. -f1,2)

    jq --arg node "$node_major" \
       --arg python "$python_version" \
       --arg go "$go_version" \
       '
       .features["ghcr.io/devcontainers/features/node:1"].version = $node |
       .features["ghcr.io/devcontainers/features/python:1"].version = $python |
       .features["ghcr.io/devcontainers/features/go:1"].version = $go |
       .build.args.NODE_VERSION = $node
       ' "$devcontainer" > "$temp_file"

    if ! diff -q "$devcontainer" "$temp_file" &>/dev/null; then
        CHANGES_NEEDED=true
        if [[ "$CHECK_ONLY" == "true" ]]; then
            echo "   ⚠️  Changes needed (check mode)"
            rm -f "$temp_file"
        else
            mv "$temp_file" "$devcontainer"
            echo "   ✓ Updated"
        fi
    else
        echo "   ✓ Already in sync"
        rm -f "$temp_file"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Update flake.nix (if present)
# ─────────────────────────────────────────────────────────────────────────────
update_flake() {
    local flake="$REPO_ROOT/flake.nix"

    if [[ ! -f "$flake" ]]; then
        echo "ℹ️  flake.nix not found (Nix path not configured)"
        return
    fi

    echo "❄️  Updating flake.nix..."

    local overlay_dir="$REPO_ROOT/nix/overlays"
    local overlay_file="$overlay_dir/versions.nix"
    mkdir -p "$overlay_dir"

    cat > "$overlay_file" << EOF
# Auto-generated by sync-tool-versions.sh
# DO NOT EDIT MANUALLY
{
  nodejs = "${VERSIONS[nodejs]:-22.11.0}";
  python = "${VERSIONS[python]:-3.11.9}";
  go = "${VERSIONS[go]:-1.21.13}";
  supabase = "${VERSIONS[supabase]:-1.200.3}";
  terraform = "${VERSIONS[terraform]:-1.9.8}";
}
EOF

    echo "   ✓ nix/overlays/versions.nix updated"
    echo "   ⚠️  Run 'nix flake lock --update-input nixpkgs' to update lock"
}

# ─────────────────────────────────────────────────────────────────────────────
# Generate CI matrix
# ─────────────────────────────────────────────────────────────────────────────
update_ci() {
    local ci_dir="$REPO_ROOT/.github"
    local ci_versions="$ci_dir/versions.json"

    mkdir -p "$ci_dir"

    echo "🔄 Generating CI version matrix..."

    jq -n \
       --arg node "${VERSIONS[nodejs]:-22.11.0}" \
       --arg python "${VERSIONS[python]:-3.11.9}" \
       --arg go "${VERSIONS[go]:-1.21.13}" \
       '{
         nodejs: $node,
         python: $python,
         go: $go,
         matrix: {
           node: [$node],
           os: ["ubuntu-22.04"]
         }
       }' > "$ci_versions"

    echo "   ✓ .github/versions.json updated"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
main() {
    echo "🔄 Synchronizing tool versions..."
    echo ""

    update_dockerfile
    update_devcontainer
    update_flake
    update_ci

    echo ""
    if [[ "$CHANGES_NEEDED" == "true" ]]; then
        if [[ "$CHECK_ONLY" == "true" ]]; then
            echo "⚠️  Some files need updating. Run without --check to apply."
            exit 1
        else
            echo "✅ All version sources synchronized!"
        fi
    else
        echo "✅ All files already in sync!"
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Rebuild container: Cmd+Shift+P → 'Rebuild Container'"
    echo "  3. Commit: git add -A && git commit -m 'chore: sync tool versions'"
}

main "$@"
