#!/bin/bash
###############################################################################
# Dev Container - On Create Script
# Runs once when the container is first created
# Optimized for speed and caching
###############################################################################

set -e

echo "🚀 Running on-create setup..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# 1. Configure Git
print_status "Configuring Git..."
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.autocrlf input
git config --global core.fileMode false
print_success "Git configured"

# 2. Set up Git hooks
print_status "Setting up Git hooks..."
if [ -f ".devcontainer/setup-git-hooks.sh" ]; then
    bash .devcontainer/setup-git-hooks.sh
    print_success "Git hooks installed"
fi

# 3. Create necessary directories
print_status "Creating workspace directories..."
mkdir -p \
    .cache \
    logs \
    tmp \
    coverage \
    dist
print_success "Directories created"

# 4. Set up environment files
print_status "Setting up environment files..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    print_success "Created .env from .env.example"
fi

# 5. Install global tools (if not cached)
print_status "Checking global tools..."
if ! command -v supabase &> /dev/null; then
    npm install -g supabase
fi
print_success "Global tools ready"

# 6. Set up shell completions
print_status "Setting up shell completions..."
if command -v kubectl &> /dev/null; then
    kubectl completion zsh > ~/.oh-my-zsh/completions/_kubectl 2>/dev/null || true
fi
if command -v docker &> /dev/null; then
    docker completion zsh > ~/.oh-my-zsh/completions/_docker 2>/dev/null || true
fi
print_success "Shell completions configured"

# 7. Create useful aliases
print_status "Creating shell aliases..."
cat >> ~/.zshrc << 'EOF'

# ValueCanvas aliases
alias dc='docker-compose'
alias k='kubectl'
alias tf='terraform'
alias npm-clean='rm -rf node_modules package-lock.json && npm install'
alias dev='npm run dev'
alias test='npm test'
alias build='npm run build'
alias lint='npm run lint'
alias db='npm run db:push'

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph --decorate'

# Quick navigation
alias ws='cd /workspace'
EOF
print_success "Aliases created"

echo ""
echo "✅ On-create setup complete!"
echo ""
