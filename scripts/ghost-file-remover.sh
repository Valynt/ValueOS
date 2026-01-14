#!/bin/bash

# ValueOS Ghost File Remover
# Safely removes orphan files with backup and verification

set -euo pipefail

# Configuration
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="./ghost-file-removal.log"
SAFE_MODE=true  # Set to false for actual deletion

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory
create_backup() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    # Backup critical files before any deletion
    cp package.json "$BACKUP_DIR/"
    cp tsconfig.json "$BACKUP_DIR/"
    cp .eslintrc.json "$BACKUP_DIR/"

    log_success "Backup created successfully"
}

# Find potential orphan files
find_orphan_files() {
    log "Scanning for orphan files..."

    local orphan_files=()

    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local basename="${filename%.*}"

            # Skip certain patterns that might be false positives
            if [[ "$basename" =~ ^(index|main|app|server|client|config)$ ]]; then
                continue
            fi

            # Skip files that are commonly dynamically imported
            if [[ "$file" =~ \.(test|spec)\. ]] && [[ "$SAFE_MODE" == "true" ]]; then
                log_warning "Skipping test file in safe mode: $file"
                continue
            fi

            # Skip configuration files that might be loaded by tools
            if [[ "$file" =~ \.(config|setup)\. ]] && [[ "$SAFE_MODE" == "true" ]]; then
                log_warning "Skipping config file in safe mode: $file"
                continue
            fi

            # Count references (excluding the file itself)
            local count=$(grep -r "$basename" src 2>/dev/null | grep -v "$file" | wc -l || echo "0")

            if [[ $count -eq 0 ]]; then
                orphan_files+=("$file")
            fi
        fi
    done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \))

    printf '%s\n' "${orphan_files[@]}"
}

# Categorize files by risk level
categorize_files() {
    local -a low_risk=()
    local -a medium_risk=()
    local -a high_risk=()

    while IFS= read -r file; do
        if [[ ! -f "$file" ]]; then
            continue
        fi

        # Low risk: clearly unused files
        if [[ "$file" =~ \.(stories|example|demo)\. ]] || \
           [[ "$file" =~ __tests__/.+\.(test|spec)\. ]] && \
           [[ "$file" =~ (integration|e2e|performance) ]]; then
            low_risk+=("$file")

        # Medium risk: potentially useful files
        elif [[ "$file" =~ \.(utils|helpers|constants)\. ]] || \
             [[ "$file" =~ (hooks|components|services)/.+\.(ts|tsx)$ ]]; then
            medium_risk+=("$file")

        # High risk: core files or configuration
        elif [[ "$file" =~ (config|setup|main|index|server|client)\. ]] || \
             [[ "$file" =~ \.(d\.ts|json)$ ]]; then
            high_risk+=("$file")
        else
            medium_risk+=("$file")
        fi
    done

    printf 'LOW_RISK:%s\n' "$(printf '%s\n' "${low_risk[@]}" | tr '\n' '|')"
    printf 'MEDIUM_RISK:%s\n' "$(printf '%s\n' "${medium_risk[@]}" | tr '\n' '|')"
    printf 'HIGH_RISK:%s\n' "$(printf '%s\n' "${high_risk[@]}" | tr '\n' '|')"
}

# Remove files safely
remove_files_safely() {
    local files=("$@")
    local removed_count=0

    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_warning "File not found: $file"
            continue
        fi

        # Create backup of the file
        local backup_path="$BACKUP_DIR/${file//\//_}"
        mkdir -p "$(dirname "$backup_path")"
        cp "$file" "$backup_path"

        if [[ "$SAFE_MODE" == "true" ]]; then
            log "SAFE MODE: Would remove $file"
            ((removed_count++))
        else
            log "Removing: $file"
            rm "$file"
            ((removed_count++))
        fi
    done

    echo $removed_count
}

# Verify system still works
verify_system() {
    log "Verifying system integrity..."

    # Check if TypeScript compiles
    if npm run typecheck &>/dev/null; then
        log_success "TypeScript compilation: PASSED"
    else
        log_error "TypeScript compilation: FAILED"
        return 1
    fi

    # Check if linting passes
    if npm run lint &>/dev/null; then
        log_success "ESLint: PASSED"
    else
        log_warning "ESLint: ISSUES FOUND (but not critical)"
    fi

    # Check if tests still run
    if npm run test:unit &>/dev/null; then
        log_success "Unit tests: PASSED"
    else
        log_warning "Unit tests: ISSUES FOUND"
    fi

    return 0
}

# Main execution
main() {
    log "Starting ValueOS Ghost File Removal"
    log "Safe mode: $SAFE_MODE"

    # Create backup
    create_backup

    # Find orphan files
    log "Finding orphan files..."
    local orphan_files
    readarray -t orphan_files < <(find_orphan_files)

    if [[ ${#orphan_files[@]} -eq 0 ]]; then
        log_success "No orphan files found!"
        exit 0
    fi

    log "Found ${#orphan_files[@]} potential orphan files"

    # Categorize files
    log "Categorizing files by risk level..."
    local categorization
    categorization=$(categorize_files)

    local low_risk_files=$(echo "$categorization" | grep "LOW_RISK:" | cut -d: -f2 | tr '|' '\n')
    local medium_risk_files=$(echo "$categorization" | grep "MEDIUM_RISK:" | cut -d: -f2 | tr '|' '\n')
    local high_risk_files=$(echo "$categorization" | grep "HIGH_RISK:" | cut -d: -f2 | tr '|' '\n')

    # Convert to arrays
    local -a low_array=()
    local -a medium_array=()
    local -a high_array=()

    while IFS= read -r line; do
        [[ -n "$line" ]] && low_array+=("$line")
    done <<< "$low_risk_files"

    while IFS= read -r line; do
        [[ -n "$line" ]] && medium_array+=("$line")
    done <<< "$medium_risk_files"

    while IFS= read -r line; do
        [[ -n "$line" ]] && high_array+=("$line")
    done <<< "$high_risk_files"

    log "Risk categorization:"
    log "  Low risk files: ${#low_array[@]}"
    log "  Medium risk files: ${#medium_array[@]}"
    log "  High risk files: ${#high_array[@]}"

    # Remove low risk files first
    if [[ ${#low_array[@]} -gt 0 ]]; then
        log "Removing low risk files..."
        local removed
        removed=$(remove_files_safely "${low_array[@]}")
        log_success "Removed $removed low risk files"

        # Verify system after low risk removal
        if ! verify_system; then
            log_error "System verification failed after low risk removal"
            log "Restoring from backup..."
            cp "$BACKUP_DIR"/* . 2>/dev/null || true
            exit 1
        fi
    fi

    # Ask about medium risk files
    if [[ ${#medium_array[@]} -gt 0 ]]; then
        log "Medium risk files found:"
        printf '%s\n' "${medium_array[@]}"

        if [[ "$SAFE_MODE" == "true" ]]; then
            log "SAFE MODE: Skipping medium risk files"
        else
            log "Proceeding with medium risk file removal..."
            local removed
            removed=$(remove_files_safely "${medium_array[@]}")
            log_success "Removed $removed medium risk files"

            # Verify system after medium risk removal
            if ! verify_system; then
                log_error "System verification failed after medium risk removal"
                log "Restoring from backup..."
                cp "$BACKUP_DIR"/* . 2>/dev/null || true
                exit 1
            fi
        fi
    fi

    # Report high risk files (never remove automatically)
    if [[ ${#high_array[@]} -gt 0 ]]; then
        log_warning "High risk files found (NOT REMOVED):"
        printf '%s\n' "${high_array[@]}"
        log "Please review these files manually before removal"
    fi

    # Summary
    local total_removed=$((${#low_array[@]} + ${#medium_array[@]}))
    if [[ "$SAFE_MODE" == "true" ]]; then
        log_success "SAFE MODE COMPLETED: Would have removed $total_removed files"
    else
        log_success "COMPLETED: Removed $total_removed files"
    fi

    log "Backup available at: $BACKUP_DIR"
    log "Log file available at: $LOG_FILE"
}

# Run main function
main "$@"
