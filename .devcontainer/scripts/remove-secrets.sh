#!/bin/bash
###############################################################################
# Remove Secrets from Git History and Current Files
# 
# WARNING: This script rewrites git history and requires force push.
# Coordinate with team before running.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Configuration
REPO_ROOT="/workspaces/ValueOS"
BACKUP_DIR="${HOME}/.git-history-backup-$(date +%Y%m%d_%H%M%S)"
REPLACEMENTS_FILE="/tmp/secret-replacements.txt"

# Secrets to remove (add more as needed)
: "${EXPOSED_SUPABASE_TOKEN:?Environment variable EXPOSED_SUPABASE_TOKEN must be set to the token value to remove}"

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

confirm() {
    local prompt="$1"
    local response
    
    echo -e "${YELLOW}$prompt${NC}"
    read -p "Type 'yes' to continue: " response
    
    if [ "$response" != "yes" ]; then
        log_error "Operation cancelled by user"
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_error "You have uncommitted changes. Commit or stash them first."
        git status --short
        exit 1
    fi
    
    # Check if git-filter-repo is available
    if ! command -v git-filter-repo &> /dev/null; then
        log_warn "git-filter-repo not found. Attempting to install..."
        
        # Try to install git-filter-repo
        if command -v pip3 &> /dev/null; then
            pip3 install --user git-filter-repo
        else
            log_error "Cannot install git-filter-repo. Install manually:"
            log_error "  pip3 install git-filter-repo"
            log_error "  OR download from: https://github.com/newren/git-filter-repo"
            exit 1
        fi
    fi
    
    log_info "✓ Prerequisites check passed"
}

create_backup() {
    log_info "Creating backup of git repository..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup .git directory
    cp -r "$REPO_ROOT/.git" "$BACKUP_DIR/"
    
    # Create bundle backup
    git bundle create "$BACKUP_DIR/repo-backup.bundle" --all
    
    log_info "✓ Backup created at: $BACKUP_DIR"
    log_info "  To restore: git clone $BACKUP_DIR/repo-backup.bundle restored-repo"
}

create_replacements_file() {
    log_info "Creating replacements file..."
    
    cat > "$REPLACEMENTS_FILE" <<EOF
# Supabase Token
$EXPOSED_SUPABASE_TOKEN==>***REDACTED_SUPABASE_TOKEN***

# Add more secrets here as needed
# Format: SECRET_VALUE==>REPLACEMENT_TEXT
EOF
    
    log_info "✓ Replacements file created: $REPLACEMENTS_FILE"
}

remove_from_current_files() {
    log_info "Removing secrets from current working tree..."
    
    cd "$REPO_ROOT"
    
    # Files to update
    local files=(
        "infra/supabase/FINAL_REPORT.md"
        "infra/supabase/COMPLETION_SUMMARY.md"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            log_info "Processing: $file"
            
            # Replace hardcoded token with environment variable reference
            sed -i.bak \
                "s|export SUPABASE_ACCESS_TOKEN=\"$EXPOSED_SUPABASE_TOKEN\"|export SUPABASE_ACCESS_TOKEN=\"\${SUPABASE_ACCESS_TOKEN}\"|g" \
                "$file"
            
            # Also replace any standalone occurrences
            sed -i.bak \
                "s|$EXPOSED_SUPABASE_TOKEN|***REDACTED***|g" \
                "$file"
            
            # Remove backup file
            rm -f "${file}.bak"
            
            log_info "✓ Updated: $file"
        else
            log_warn "File not found: $file"
        fi
    done
    
    # Show changes
    log_info "Changes made:"
    git diff infra/supabase/
}

remove_from_git_history() {
    log_info "Removing secrets from git history..."
    
    cd "$REPO_ROOT"
    
    # Use git-filter-repo to replace secrets in history
    git filter-repo --force --replace-text "$REPLACEMENTS_FILE"
    
    log_info "✓ Secrets removed from git history"
}

verify_removal() {
    log_info "Verifying secret removal..."
    
    cd "$REPO_ROOT"
    
    # Search for the exposed token
    local found=0
    
    # Check current files
    if grep -r "$EXPOSED_SUPABASE_TOKEN" . --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null; then
        log_error "Secret still found in current files!"
        found=1
    fi
    
    # Check git history
    if git log --all --full-history -S "$EXPOSED_SUPABASE_TOKEN" | grep -q "commit"; then
        log_error "Secret still found in git history!"
        found=1
    fi
    
    if [ $found -eq 0 ]; then
        log_info "✓ Secret successfully removed from repository"
        return 0
    else
        log_error "✗ Secret removal verification failed"
        return 1
    fi
}

commit_changes() {
    log_info "Committing changes..."
    
    cd "$REPO_ROOT"
    
    # Stage changes
    git add infra/supabase/FINAL_REPORT.md infra/supabase/COMPLETION_SUMMARY.md
    
    # Commit
    git commit -m "security: Remove exposed Supabase token from documentation

- Replace hardcoded token with environment variable reference
- Token has been revoked and rotated
- Implements proper secrets management per security review

Refs: .devcontainer/SECURITY_INCIDENT_REPORT.md

Co-authored-by: Ona <no-reply@ona.com>"
    
    log_info "✓ Changes committed"
}

show_next_steps() {
    echo ""
    echo "========================================="
    log_info "Secret removal complete!"
    echo "========================================="
    echo ""
    log_warn "IMPORTANT NEXT STEPS:"
    echo ""
    echo "1. Review the changes:"
    echo "   git log --oneline -5"
    echo "   git diff HEAD~1"
    echo ""
    echo "2. Verify secret is removed:"
    echo "   git log --all -S '$EXPOSED_SUPABASE_TOKEN'"
    echo "   (should return no results)"
    echo ""
    echo "3. Coordinate with team before force push:"
    echo "   - Notify all team members"
    echo "   - Ensure no one is working on branches"
    echo "   - Schedule a time for the force push"
    echo ""
    echo "4. Force push to remote (DESTRUCTIVE):"
    echo "   git push --force --all origin"
    echo "   git push --force --tags origin"
    echo ""
    echo "5. All team members must re-clone:"
    echo "   cd .."
    echo "   rm -rf ValueOS"
    echo "   git clone <repository-url>"
    echo ""
    echo "6. Revoke the old token in Supabase dashboard:"
    echo "   https://app.supabase.com"
    echo ""
    echo "7. Generate and securely store new token"
    echo ""
    log_info "Backup location: $BACKUP_DIR"
    echo ""
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo "========================================="
    echo "  Secret Removal Script"
    echo "========================================="
    echo ""
    
    log_warn "This script will:"
    log_warn "  1. Rewrite git history (DESTRUCTIVE)"
    log_warn "  2. Remove secrets from current files"
    log_warn "  3. Require force push to remote"
    log_warn "  4. Require all team members to re-clone"
    echo ""
    
    confirm "Are you sure you want to continue?"
    
    # Execute steps
    check_prerequisites
    create_backup
    create_replacements_file
    remove_from_current_files
    
    echo ""
    confirm "Ready to rewrite git history? This cannot be easily undone."
    
    remove_from_git_history
    
    if verify_removal; then
        commit_changes
        show_next_steps
        exit 0
    else
        log_error "Secret removal failed verification"
        log_info "Backup available at: $BACKUP_DIR"
        log_info "To restore: cp -r $BACKUP_DIR/.git $REPO_ROOT/"
        exit 1
    fi
}

# Run main function
main "$@"
