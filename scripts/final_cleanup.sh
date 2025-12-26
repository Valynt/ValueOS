#!/bin/bash
#
# Final cleanup script to achieve the ideal repository structure.
# This script automates the final file moves and consolidations.
# Run from the repository root.
#

set -e

echo "--- Starting final repository cleanup ---"

# 1. Move shell scripts into /scripts directory
echo ""
echo "Step 1: Moving shell scripts to /scripts..."
mkdir -p scripts
SCRIPTS_TO_MOVE="cleanup.sh consolidate.sh deploy-production.sh dev-setup.sh start-docker.sh start.sh"
for s in $SCRIPTS_TO_MOVE; do
    if [ -f "$s" ]; then
        mv "$s" scripts/
        echo " - Moved $s to scripts/"
    else
        echo " - Warning: Script '$s' not found, skipping."
    fi
done
echo "Shell scripts moved."

# 2. Move public/public/index.html files to /public
echo ""
echo "Step 2: Moving public/public/index.html and index.production.html to /public..."
mkdir -p public
if [ -f "public/public/index.html" ]; then
    mv "public/public/index.html" public/
    echo " - Moved public/public/index.html"
fi
if [ -f "index.production.html" ]; then
    mv "index.production.html" public/
    echo " - Moved index.production.html"
fi
echo "HTML files moved."
echo "Note: Vite automatically uses 'public' as the public asset directory, so no changes to vite.config.ts should be required."

# 3. Consolidate infrastructure directories into /infra
echo ""
echo "Step 3: Consolidating all infrastructure code into /infra..."
mkdir -p infra/docker infra/k8s infra/caddy infra/monitoring infra/backups

# Helper function to safely move contents from a source dir to a destination
# and then remove the empty source directory.
move_contents() {
    local src_dir=$1
    local dest_dir=$2
    if [ -d "$src_dir" ]; then
        # Check if source directory has any files/subdirectories to move
        if [ -n "$(ls -A "$src_dir")" ]; then
            echo " - Moving contents from '$src_dir' to '$dest_dir'..."
            # Use rsync to safely handle moving all files, including hidden ones
            rsync -av "$src_dir"/ "$dest_dir"/
            # Remove the original source directory now that its contents are moved
            rm -rf "$src_dir"
            echo " - Removed original directory '$src_dir'."
        else
            echo " - Directory '$src_dir' is empty, removing..."
            rm -rf "$src_dir"
        fi
    else
        echo " - Directory '$src_dir' not found, skipping."
    fi
}

move_contents "infrastructure" "infra"
move_contents "docker" "infra/docker"
move_contents "k8s" "infra/k8s"
move_contents "kubernetes" "infra/k8s"
move_contents "caddy-config" "infra/caddy"
echo "Infrastructure consolidation complete."

# 4. Move SQL backup file
echo ""
echo "Step 4: Archiving SQL backup file..."
if [ -f "backup-20251201.sql" ]; then
    mv "backup-20251201.sql" "infra/backups/"
    echo " - Moved backup-20251201.sql to infra/backups/"
else
    echo " - Warning: backup-20251201.sql not found, skipping."
fi

echo ""
echo "--- Cleanup Complete ---"
echo ""
echo "IMPORTANT: MANUAL STEP REQUIRED!"
echo "The automated file moves are complete. You must now manually search the codebase"
echo "for any hardcoded paths that might be broken by these changes. Check files like:"
echo " - package.json scripts"
echo " - docker-compose.yml files (e.g., build contexts)"
echo " - GitHub Actions workflows (.github/workflows)"
echo " - Any other configuration or script files"
echo "For example, a reference to './infra/infra/docker/backend.Dockerfile' may need to be changed to './infra/infra/infra/docker/backend.Dockerfile'."
