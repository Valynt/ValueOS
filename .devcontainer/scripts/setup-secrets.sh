#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 ValueOS Secret Management Setup${NC}"
echo "===================================="

# Configuration
DOPPLER_PROJECT=${DOPPLER_PROJECT:-valueos-dev}
DOPPLER_CONFIG=${DOPPLER_CONFIG:-dev}

# 1. Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Doppler CLI...${NC}"
    curl -Ls https://cli.doppler.com/install.sh | sh

    # Update PATH for current session
    if [ -d "$HOME/bin" ]; then
        export PATH="$HOME/bin:$PATH"
    elif [ -d "/root/bin" ]; then
        export PATH="/root/bin:$PATH"
    fi

    echo -e "${GREEN}✅ Doppler CLI installed${NC}"
else
    echo -e "${GREEN}✅ Doppler CLI already installed${NC}"
fi

# 2. Check if user is authenticated
if ! doppler whoami &> /dev/null; then
    echo -e "${YELLOW}🔑 Please authenticate with Doppler...${NC}"
    echo "This will open a browser for authentication."
    doppler login
else
    echo -e "${GREEN}✅ Already authenticated with Doppler${NC}"
fi

# 3. Setup project and config
echo -e "${YELLOW}⚙️ Setting up Doppler project...${NC}"
echo "Project: $DOPPLER_PROJECT"
echo "Config: $DOPPLER_CONFIG"

# Check if project exists, create if it doesn't
if ! doppler projects list --format json | jq -r ".[].name" | grep -q "^$DOPPLER_PROJECT$"; then
    echo -e "${YELLOW}📝 Creating Doppler project: $DOPPLER_PROJECT${NC}"
    doppler projects create --name "$DOPPLER_PROJECT" --description "ValueOS Development Environment"
else
    echo -e "${GREEN}✅ Project $DOPPLER_PROJECT already exists${NC}"
fi

# Check if config exists, create if it doesn't
if ! doppler configs list --project "$DOPPLER_PROJECT" --format json | jq -r ".[].name" | grep -q "^$DOPPLER_CONFIG$"; then
    echo -e "${YELLOW}📝 Creating Doppler config: $DOPPLER_CONFIG${NC}"
    doppler configs create --project "$DOPPLER_PROJECT" --name "$DOPPLER_CONFIG" --environment "dev"
else
    echo -e "${GREEN}✅ Config $DOPPLER_CONFIG already exists${NC}"
fi

# 4. Import existing secrets from .env.local if it exists
if [ -f ".env.local" ]; then
    echo -e "${YELLOW}📥 Importing existing secrets from .env.local...${NC}"

    # Read .env.local and import secrets
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^[[:space:]]*# ]] && continue
        [[ -z $key ]] && continue

        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')

        # Skip if value is empty or placeholder
        [[ -z $value ]] && continue
        [[ $value =~ ^(your-.*-here|CHANGE_ME|localhost:.*|http://localhost:.*|https://localhost:.*)$ ]] && continue

        echo "  Importing: $key"
        doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "$key" "$value" --silent
    done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.local)

    echo -e "${GREEN}✅ Secrets imported from .env.local${NC}"
else
    echo -e "${YELLOW}⚠️ No .env.local file found, creating default secrets...${NC}"

    # Create default development secrets
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "NODE_ENV" "development" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "POSTGRES_DB" "valuecanvas_dev" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "POSTGRES_USER" "postgres" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "POSTGRES_PASSWORD" "postgres" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "REDIS_URL" "redis://localhost:6379" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "VITE_PORT" "5173" --silent
    doppler secrets set --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" "API_PORT" "3001" --silent

    echo -e "${GREEN}✅ Default development secrets created${NC}"
fi

# 5. Create .env.local from Doppler secrets
echo -e "${YELLOW}📥 Creating .env.local from Doppler secrets...${NC}"
doppler secrets download --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --no-file --format env > .env.local

# 6. Verify critical secrets
echo -e "${YELLOW}🔍 Verifying critical secrets...${NC}"
missing_secrets=()

# Check for required secrets
required_secrets=(
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "VITE_PORT"
    "API_PORT"
)

for secret in "${required_secrets[@]}"; do
    if ! grep -q "^${secret}=" .env.local; then
        missing_secrets+=("$secret")
    fi
done

if [ ${#missing_secrets[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing critical secrets:${NC}"
    for secret in "${missing_secrets[@]}"; do
        echo "  - $secret"
    done
    echo ""
    echo -e "${YELLOW}💡 Please configure these secrets in Doppler dashboard:${NC}"
    echo "   https://dashboard.doppler.com/$DOPPLER_PROJECT/$DOPPLER_CONFIG"
    exit 1
else
    echo -e "${GREEN}✅ All critical secrets are present${NC}"
fi

# 7. Create Doppler helper script
echo -e "${YELLOW}🔧 Creating Doppler helper script...${NC}"
mkdir -p .local/bin
cat > .local/bin/doppler-sync << 'EOF'
#!/bin/bash
echo "🔄 Syncing secrets from Doppler..."
doppler secrets download --no-file --format env > .env.local
echo "✅ Secrets synced to .env.local"
EOF
chmod +x .local/bin/doppler-sync

# 8. Create rotate script
echo -e "${YELLOW}🔄 Creating secret rotation script...${NC}"
cat > .local/bin/rotate-secrets << 'EOF'
#!/bin/bash
echo "🔄 Rotating secrets..."

# Generate new JWT secret
new_jwt=$(openssl rand -base64 32)
doppler secrets set JWT_SECRET "$new_jwt"

echo "✅ JWT secret rotated"
echo "💡 Run 'doppler-sync' to update local .env.local"
EOF
chmod +x .local/bin/rotate-secrets

echo ""
echo -e "${GREEN}✅ Doppler secret management setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Quick commands:${NC}"
echo "  doppler-sync     - Sync secrets from Doppler to .env.local"
echo "  rotate-secrets   - Rotate critical secrets"
echo "  doppler run      - Run commands with Doppler secrets"
echo ""
echo -e "${YELLOW}🌐 Doppler Dashboard:${NC}"
echo "  https://dashboard.doppler.com/$DOPPLER_PROJECT/$DOPPLER_CONFIG"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Review secrets in Doppler dashboard"
echo "  2. Update any placeholder values"
echo "  3. Run './bin/dev-up' to start development"
