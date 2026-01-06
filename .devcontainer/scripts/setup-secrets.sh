#!/bin/bash
###############################################################################
# Setup Docker Secrets for Dev Container
# 
# This script helps configure secrets for secure credential management
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SECRETS_DIR="/workspaces/ValueOS/.devcontainer/secrets"
ENV_FILE="/workspaces/ValueOS/.env"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

###############################################################################
# Create secrets directory
###############################################################################

setup_secrets_directory() {
    log_info "Setting up secrets directory..."
    
    # Create directory
    mkdir -p "$SECRETS_DIR"
    
    # Set restrictive permissions
    chmod 700 "$SECRETS_DIR"
    
    # Create .gitignore to prevent accidental commits
    cat > "$SECRETS_DIR/.gitignore" <<EOF
# Ignore all secret files
*

# Except this .gitignore and README
!.gitignore
!README.md
EOF
    
    log_info "✓ Secrets directory created: $SECRETS_DIR"
}

###############################################################################
# Create README for secrets directory
###############################################################################

create_secrets_readme() {
    cat > "$SECRETS_DIR/README.md" <<'EOF'
# Secrets Directory

This directory contains sensitive credentials for the dev container.

## Security

- **NEVER commit secret files to git**
- All files except `.gitignore` and `README.md` are gitignored
- Permissions are set to 700 (owner read/write/execute only)

## Secret Files

Each secret should be in its own file with no trailing newline:

- `supabase_token.txt` - Supabase Management API token
- `jwt_secret.txt` - JWT signing secret
- `together_api_key.txt` - Together.ai API key
- `db_password.txt` - PostgreSQL password
- `redis_password.txt` - Redis password

## Creating Secrets

### From .env file (automated):
```bash
bash ../.devcontainer/scripts/setup-secrets.sh
```

### Manually:
```bash
# Create secret file (no trailing newline)
echo -n "your-secret-value" > supabase_token.txt

# Set restrictive permissions
chmod 600 supabase_token.txt
```

## Using Secrets

Secrets are mounted as files in the container at `/run/secrets/`:

```bash
# Read secret in container
SUPABASE_TOKEN=$(cat /run/secrets/supabase_token)

# Or use environment variable that references the file
# (configured in docker-compose.secrets.yml)
```

## Rotating Secrets

1. Generate new secret value
2. Update secret file: `echo -n "new-value" > secret_name.txt`
3. Restart container: `docker-compose restart`

## Backup

Secrets are NOT backed up automatically. Store securely:
- Password manager (1Password, LastPass, Bitwarden)
- Secret management service (Vault, AWS Secrets Manager)
- Encrypted backup location

## Production

For production, use proper secret management:
- Kubernetes Secrets
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager
EOF
    
    log_info "✓ Created README.md in secrets directory"
}

###############################################################################
# Extract secrets from .env file
###############################################################################

extract_from_env() {
    log_info "Extracting secrets from .env file..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warn ".env file not found: $ENV_FILE"
        log_warn "You'll need to create secret files manually"
        return 1
    fi
    
    # Extract secrets (remove quotes and whitespace)
    local supabase_token=$(grep "^SUPABASE_ACCESS_TOKEN=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    local jwt_secret=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    local together_key=$(grep "^TOGETHER_API_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    local db_password=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    local redis_password=$(grep "^REDIS_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    
    # Create secret files (no trailing newline)
    if [ -n "$supabase_token" ] && [ "$supabase_token" != "your-supabase-token-here" ]; then
        echo -n "$supabase_token" > "$SECRETS_DIR/supabase_token.txt"
        chmod 600 "$SECRETS_DIR/supabase_token.txt"
        log_info "✓ Created: supabase_token.txt"
    else
        log_warn "Supabase token not found or is placeholder"
    fi
    
    if [ -n "$jwt_secret" ] && [ "$jwt_secret" != "your-jwt-secret-here" ]; then
        echo -n "$jwt_secret" > "$SECRETS_DIR/jwt_secret.txt"
        chmod 600 "$SECRETS_DIR/jwt_secret.txt"
        log_info "✓ Created: jwt_secret.txt"
    else
        log_warn "JWT secret not found or is placeholder"
    fi
    
    if [ -n "$together_key" ] && [ "$together_key" != "your-together-api-key-here" ]; then
        echo -n "$together_key" > "$SECRETS_DIR/together_api_key.txt"
        chmod 600 "$SECRETS_DIR/together_api_key.txt"
        log_info "✓ Created: together_api_key.txt"
    else
        log_warn "Together API key not found or is placeholder"
    fi
    
    if [ -n "$db_password" ] && [ "$db_password" != "\${DB_PASSWORD}" ]; then
        echo -n "$db_password" > "$SECRETS_DIR/db_password.txt"
        chmod 600 "$SECRETS_DIR/db_password.txt"
        log_info "✓ Created: db_password.txt"
    else
        # Generate random password if not set
        local generated_password=$(openssl rand -base64 32)
        echo -n "$generated_password" > "$SECRETS_DIR/db_password.txt"
        chmod 600 "$SECRETS_DIR/db_password.txt"
        log_info "✓ Generated: db_password.txt"
    fi
    
    if [ -n "$redis_password" ] && [ "$redis_password" != "\${REDIS_PASSWORD}" ]; then
        echo -n "$redis_password" > "$SECRETS_DIR/redis_password.txt"
        chmod 600 "$SECRETS_DIR/redis_password.txt"
        log_info "✓ Created: redis_password.txt"
    else
        # Generate random password if not set
        local generated_password=$(openssl rand -base64 32)
        echo -n "$generated_password" > "$SECRETS_DIR/redis_password.txt"
        chmod 600 "$SECRETS_DIR/redis_password.txt"
        log_info "✓ Generated: redis_password.txt"
    fi
}

###############################################################################
# Create helper script to load secrets
###############################################################################

create_load_secrets_script() {
    cat > "$SECRETS_DIR/../load-secrets.sh" <<'EOF'
#!/bin/bash
###############################################################################
# Load Secrets into Environment Variables
# 
# Source this script to load secrets from files into environment variables:
#   source .devcontainer/load-secrets.sh
###############################################################################

SECRETS_DIR="/run/secrets"

# Check if running in container with mounted secrets
if [ -d "$SECRETS_DIR" ]; then
    # Load from Docker secrets
    [ -f "$SECRETS_DIR/supabase_token" ] && export SUPABASE_ACCESS_TOKEN=$(cat "$SECRETS_DIR/supabase_token")
    [ -f "$SECRETS_DIR/jwt_secret" ] && export JWT_SECRET=$(cat "$SECRETS_DIR/jwt_secret")
    [ -f "$SECRETS_DIR/together_api_key" ] && export TOGETHER_API_KEY=$(cat "$SECRETS_DIR/together_api_key")
    [ -f "$SECRETS_DIR/db_password" ] && export DB_PASSWORD=$(cat "$SECRETS_DIR/db_password")
    [ -f "$SECRETS_DIR/redis_password" ] && export REDIS_PASSWORD=$(cat "$SECRETS_DIR/redis_password")
    
    echo "✓ Secrets loaded from Docker secrets"
else
    # Load from local secret files
    LOCAL_SECRETS_DIR="$(dirname "$0")/secrets"
    
    if [ -d "$LOCAL_SECRETS_DIR" ]; then
        [ -f "$LOCAL_SECRETS_DIR/supabase_token.txt" ] && export SUPABASE_ACCESS_TOKEN=$(cat "$LOCAL_SECRETS_DIR/supabase_token.txt")
        [ -f "$LOCAL_SECRETS_DIR/jwt_secret.txt" ] && export JWT_SECRET=$(cat "$LOCAL_SECRETS_DIR/jwt_secret.txt")
        [ -f "$LOCAL_SECRETS_DIR/together_api_key.txt" ] && export TOGETHER_API_KEY=$(cat "$LOCAL_SECRETS_DIR/together_api_key.txt")
        [ -f "$LOCAL_SECRETS_DIR/db_password.txt" ] && export DB_PASSWORD=$(cat "$LOCAL_SECRETS_DIR/db_password.txt")
        [ -f "$LOCAL_SECRETS_DIR/redis_password.txt" ] && export REDIS_PASSWORD=$(cat "$LOCAL_SECRETS_DIR/redis_password.txt")
        
        echo "✓ Secrets loaded from local files"
    else
        echo "⚠️  Secrets directory not found"
    fi
fi
EOF
    
    chmod +x "$SECRETS_DIR/../load-secrets.sh"
    log_info "✓ Created load-secrets.sh helper script"
}

###############################################################################
# Verify secrets setup
###############################################################################

verify_secrets() {
    log_info "Verifying secrets setup..."
    
    local all_good=true
    
    # Check directory permissions
    local dir_perms=$(stat -c %a "$SECRETS_DIR" 2>/dev/null || stat -f %A "$SECRETS_DIR")
    if [ "$dir_perms" != "700" ]; then
        log_warn "Secrets directory permissions: $dir_perms (should be 700)"
        all_good=false
    fi
    
    # Check for secret files
    local secret_files=(
        "supabase_token.txt"
        "jwt_secret.txt"
        "together_api_key.txt"
        "db_password.txt"
        "redis_password.txt"
    )
    
    for file in "${secret_files[@]}"; do
        if [ -f "$SECRETS_DIR/$file" ]; then
            local file_perms=$(stat -c %a "$SECRETS_DIR/$file" 2>/dev/null || stat -f %A "$SECRETS_DIR/$file")
            if [ "$file_perms" != "600" ]; then
                log_warn "$file permissions: $file_perms (should be 600)"
                all_good=false
            else
                log_info "✓ $file exists with correct permissions"
            fi
        else
            log_warn "$file not found"
            all_good=false
        fi
    done
    
    if [ "$all_good" = true ]; then
        log_info "✓ All secrets configured correctly"
        return 0
    else
        log_warn "Some secrets are missing or have incorrect permissions"
        return 1
    fi
}

###############################################################################
# Show usage instructions
###############################################################################

show_usage() {
    echo ""
    echo "========================================="
    log_info "Secrets Setup Complete!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Verify secret files:"
    echo "   ls -la $SECRETS_DIR"
    echo ""
    echo "2. Update devcontainer to use secrets:"
    echo "   - Use docker-compose.secrets.yml"
    echo "   - Or update devcontainer.json with secret mounts"
    echo ""
    echo "3. Load secrets in shell:"
    echo "   source .devcontainer/load-secrets.sh"
    echo ""
    echo "4. Test secret access:"
    echo "   echo \$SUPABASE_ACCESS_TOKEN"
    echo ""
    echo "5. Remove secrets from .env file (optional):"
    echo "   - Keep .env for non-sensitive config"
    echo "   - Remove sensitive values"
    echo ""
    log_warn "Remember: NEVER commit files in $SECRETS_DIR to git"
    echo ""
}

###############################################################################
# Main execution
###############################################################################

main() {
    echo "========================================="
    echo "  Docker Secrets Setup"
    echo "========================================="
    echo ""
    
    setup_secrets_directory
    create_secrets_readme
    extract_from_env
    create_load_secrets_script
    
    echo ""
    
    if verify_secrets; then
        show_usage
        exit 0
    else
        log_warn "Setup completed with warnings"
        show_usage
        exit 0
    fi
}

main "$@"
