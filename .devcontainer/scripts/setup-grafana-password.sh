#!/bin/bash
# Quick setup script for Grafana password configuration

set -e

echo "🔐 Grafana Password Setup"
echo "========================"

# Check if .env exists
if [ -f ".devcontainer/.env" ]; then
    echo "⚠️  .devcontainer/.env already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

# Copy template
cp .devcontainer/.env.example .devcontainer/.env
echo "✅ Created .devcontainer/.env from template"

# Generate secure password
echo ""
echo "🔑 Generating secure password..."
SECURE_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Update .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/your-secure-grafana-password-here/$SECURE_PASSWORD/" .devcontainer/.env
else
    # Linux
    sed -i "s/your-secure-grafana-password-here/$SECURE_PASSWORD/" .devcontainer/.env
fi

echo "✅ Set secure password: $SECURE_PASSWORD"
echo ""
echo "📋 Next Steps:"
echo "1. Rebuild your dev container"
echo "2. Grafana will be accessible at http://localhost:3001"
echo "3. Login with admin / $SECURE_PASSWORD"
echo ""
echo "🔒 You can view the password anytime in .devcontainer/.env"
