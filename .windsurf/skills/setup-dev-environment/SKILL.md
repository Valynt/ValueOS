---
name: setup-dev-environment
description: Walks through local development environment setup including dependencies and configs
---

# Setup Development Environment

This skill provides a comprehensive guide for setting up a local development environment for ValueOS, including all necessary dependencies, configurations, and validation steps.

## When to Run

Run this skill when:
- Setting up a new development machine
- Onboarding new team members
- Troubleshooting development environment issues
- Setting up CI/CD build agents
- Preparing for feature development

## Prerequisites

### System Requirements
- **Operating System**: macOS 12+, Ubuntu 20.04+, or Windows 11 with WSL2
- **Memory**: Minimum 16GB RAM, recommended 32GB
- **Storage**: Minimum 50GB free space, recommended 100GB
- **Network**: Stable internet connection for downloads

### Required Software
- **Node.js**: v18.17.0+ (managed via nvm)
- **pnpm**: v8.0.0+ (package manager)
- **Docker**: v24.0.0+ (for containerized services)
- **Git**: v2.30.0+ (version control)
- **VS Code**: Latest stable (recommended editor)

## Environment Setup Steps

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/ValueCanvas/ValueOS.git
cd ValueOS

# Initialize submodules if any
git submodule update --init --recursive

# Verify repository integrity
git fsck
```

### 2. Node.js and pnpm Setup
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source nvm
source ~/.bashrc

# Install and use correct Node.js version
nvm install 18.17.0
nvm use 18.17.0
nvm alias default 18.17.0

# Install pnpm
npm install -g pnpm@8.15.0

# Verify installations
node --version
pnpm --version
```

### 3. Docker and Container Setup
```bash
# Install Docker Desktop or Docker Engine
# macOS/Windows: Download from https://www.docker.com/products/docker-desktop
# Linux: Follow distribution-specific instructions

# Start Docker service
sudo systemctl start docker  # Linux
# or start Docker Desktop on macOS/Windows

# Verify Docker installation
docker --version
docker run hello-world

# Configure Docker for development
# Increase memory limit to 8GB in Docker Desktop settings
# Enable file sharing for project directory
```

### 4. Development Dependencies
```bash
# Install global development tools
pnpm add -g @types/node typescript eslint prettier

# Install database tools (choose based on needs)
# PostgreSQL client
brew install postgresql@15  # macOS
sudo apt install postgresql-client-15  # Ubuntu

# Redis client
brew install redis  # macOS
sudo apt install redis-tools  # Ubuntu
```

### 5. Project Dependencies Installation
```bash
# Install all project dependencies
pnpm install

# Install additional development dependencies
pnpm add -D vitest @vitest/coverage-v8 playwright

# Verify installation
pnpm list --depth=0
```

### 6. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Generate required secrets
# Database connection strings
# API keys for external services
# JWT secrets for authentication

# Edit .env.local with your local configuration
# DATABASE_URL="postgresql://localhost:5432/valueos_dev"
# REDIS_URL="redis://localhost:6379"
# JWT_SECRET="your-secure-jwt-secret-here"
```

### 7. Database Setup
```bash
# Start local PostgreSQL (if not using Docker)
brew services start postgresql@15  # macOS
sudo systemctl start postgresql  # Linux

# Create development database
createdb valueos_dev

# Run database migrations
pnpm run db:migrate

# Seed development data
pnpm run db:seed

# Verify database connection
pnpm run db:studio
```

### 8. Development Services
```bash
# Start required services with Docker Compose
docker-compose up -d postgres redis

# Or use the development script
./scripts/dev.sh up

# Verify services are running
docker ps
curl http://localhost:5432  # PostgreSQL
redis-cli ping  # Redis
```

### 9. Application Startup
```bash
# Start the development server
pnpm run dev

# Start additional services if needed
pnpm run dev:api
pnpm run dev:web

# Verify applications are running
curl http://localhost:3000  # Main application
curl http://localhost:4000/api/health  # API
```

## Configuration Files

### VS Code Setup
Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.suggest.autoImports": true,
  "emmet.includeLanguages": {
    "typescript": "html"
  }
}
```

### ESLint Configuration
Ensure `.eslintrc.js` includes:
```javascript
module.exports = {
  extends: [
    '@valueos/eslint-config',
    '@valueos/eslint-config/react'
  ],
  rules: {
    // Project-specific rules
  }
}
```

### Prettier Configuration
Configure `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

## Validation Checklist

### Environment Validation
- [ ] Node.js version matches requirements
- [ ] pnpm installed and functional
- [ ] Docker running and accessible
- [ ] Git configured with user details

### Dependency Validation
- [ ] All pnpm dependencies installed
- [ ] No dependency conflicts or warnings
- [ ] Global tools accessible (tsc, eslint, prettier)

### Service Validation
- [ ] PostgreSQL database accessible
- [ ] Redis cache responding
- [ ] Development servers starting without errors

### Application Validation
- [ ] Main application loads in browser
- [ ] API endpoints responding correctly
- [ ] Authentication flows working
- [ ] Basic functionality operational

## Troubleshooting

### Common Issues

#### Node.js Version Issues
```bash
# Clear nvm cache and reinstall
nvm cache clear
nvm uninstall 18.17.0
nvm install 18.17.0
```

#### Dependency Installation Failures
```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Docker Connection Issues
```bash
# Restart Docker service
sudo systemctl restart docker

# Check Docker daemon
docker system info
```

#### Database Connection Issues
```bash
# Verify PostgreSQL is running
brew services list | grep postgresql

# Check database exists
psql -l | grep valueos_dev

# Reset database if needed
./scripts/reset-dev-database.sh
```

### Getting Help
- Check existing issues in repository
- Review documentation in `docs/`
- Ask in `#dev-setup` Slack channel
- Contact platform team for infrastructure issues

## Advanced Setup

### Remote Development
For remote development environments:
```bash
# Use VS Code Remote-SSH
# Connect to remote machine
# Clone repository on remote
# Run setup steps above
```

### Multi-Environment Setup
For working with multiple environments:
```bash
# Create separate .env files
cp .env.local .env.staging
cp .env.local .env.production

# Use environment-specific scripts
./scripts/switch-env.sh staging
```

### Performance Optimization
For better development performance:
```bash
# Enable Docker build cache
# Configure VS Code for better TypeScript performance
# Use faster storage for Docker volumes
```

## Security Considerations

### Local Development Security
- Never commit secrets to version control
- Use strong, unique passwords for local databases
- Keep development certificates updated
- Regularly update development dependencies

### Network Security
- Use VPN for accessing production-adjacent services
- Validate SSL certificates for external services
- Monitor for suspicious network activity

## Maintenance

### Regular Updates
```bash
# Update Node.js and global tools monthly
nvm install node --latest-npm
pnpm update -g

# Update Docker images weekly
docker system prune -a

# Update project dependencies regularly
pnpm update
```

### Environment Cleanup
```bash
# Clean up Docker resources
docker system prune -a

# Remove old Node.js versions
nvm list
nvm uninstall <old-version>

# Clear development caches
pnpm store prune
```

This setup provides a complete, reproducible development environment for ValueOS development.
