# Platform Guide

> **Note:** References to `pnpm run dx` and `pnpm run dx:*` in this document are design specifications, not implemented package.json scripts. Use `gitpod automations service start <id>` to start services. See `.windsurf/automations.yaml` for the canonical service list.

**Last Updated**: 2026-02-08

**Consolidated from 3 source documents**

---

## Table of Contents

1. [ValueOS Port Configuration Template](#valueos-port-configuration-template)
2. [ValueOS on Windows](#valueos-on-windows)
3. [ValueOS on macOS](#valueos-on-macos)

---

## ValueOS Port Configuration Template

*Source: `engineering/platform/ENV_PORTS_TEMPLATE.md`*

# Copy this file to .env.ports and customize as needed
# This file is gitignored - do not commit actual values

# Database Ports
POSTGRES_PORT=5432
REDIS_PORT=6379

# Application Ports
API_PORT=3001
VITE_PORT=5173

# Supabase Ports (if running locally)
SUPABASE_API_PORT=54321
SUPABASE_STUDIO_PORT=54323

# Reverse Proxy Ports
CADDY_HTTP_PORT=8080
CADDY_HTTPS_PORT=8443
CADDY_ADMIN_PORT=2019

# Observability Ports
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000

# Security Configuration
GRAFANA_ADMIN_PASSWORD=sm://valueos/local/observability/grafana_admin_password

# Development Domain
DEV_DOMAIN=localhost

# Service URLs (auto-configured)
API_UPSTREAM=http://backend:3001
FRONTEND_UPSTREAM=http://frontend:5173

# Logging Configuration
CADDY_LOG_LEVEL=DEBUG
AUTO_HTTPS=off

---

## ValueOS on Windows

*Source: `engineering/platform/WINDOWS.md`*

**Recommended Setup**: Windows 11 + WSL2 + Docker Desktop

---

## Quick Start

```powershell
# 1. Install WSL2 (PowerShell as Administrator)
wsl --install

# 2. Restart your computer

# 3. Open Ubuntu from Start Menu

# 4. Inside WSL2:
cd /mnt/c/Users/YourName/Projects
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS
pnpm run setup
npm start
```

---

## Prerequisites

### 1. WSL2 (Windows Subsystem for Linux)

**Why**: Docker Desktop on Windows requires WSL2 for best performance.

**Installation**:

```powershell
# PowerShell as Administrator
wsl --install
wsl --set-default-version 2
```

**Verify**:

```powershell
wsl -l -v
# Should show VERSION 2
```

**Troubleshooting**:

- If stuck on WSL1: `wsl --set-version Ubuntu 2`
- Enable virtualization in BIOS if installation fails

### 2. Docker Desktop

**Download**: <https://docs.docker.com/desktop/windows/install/>

**Settings**:

- ✅ Enable "Use WSL 2 based engine"
- ✅ Enable integration with your Ubuntu distro
- ✅ Resources: Allocate at least 4GB RAM, 2 CPUs

**Verify**:

```bash
# Inside WSL2
docker --version
docker ps
```

### 3. Node.js (via nvm)

**Install nvm in WSL2**:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Verify**:

```bash
node --version  # Should be v20.x.x
npm --version
```

---

## Common Issues

### Issue 1: "Cannot connect to Docker daemon"

**Symptom**: `docker ps` fails with connection error

**Solution**:

1. Open Docker Desktop on Windows
2. Ensure it's running (whale icon in system tray)
3. Check Settings → Resources → WSL Integration
4. Enable integration with your Ubuntu distro
5. Restart WSL: `wsl --shutdown` then reopen

### Issue 2: File permissions errors

**Symptom**: `EACCES` errors when running npm install

**Solution**:

```bash
# Fix ownership
sudo chown -R $USER:$USER ~/Projects/ValueOS

# Or work in /home instead of /mnt/c
cd ~
git clone https://github.com/Valynt/ValueOS.git
```

**Why**: Files in `/mnt/c` (Windows filesystem) have different permissions than native Linux filesystem.

### Issue 3: Slow file watching / Hot reload not working

**Symptom**: Changes to files don't trigger rebuild

**Solution**:

```bash
# Option 1: Use polling (slower but works)
# Add to .env:
CHOKIDAR_USEPOLLING=true

# Option 2: Work in WSL filesystem (faster)
# Clone to ~/Projects instead of /mnt/c/Users/...
```

### Issue 4: Port already in use

**Symptom**: `EADDRINUSE: address already in use :::5173`

**Solution**:

```bash
# Find process using port
netstat -ano | findstr :5173

# Kill process (PowerShell as Admin)
taskkill /PID <PID> /F

# Or use different port
VITE_PORT=5174 npm start
```

### Issue 5: Git line endings

**Symptom**: Git shows all files as modified

**Solution**:

```bash
# Configure Git in WSL2
git config --global core.autocrlf input
git config --global core.eol lf

# Reset repository
git rm --cached -r .
git reset --hard
```

---

## Performance Tips

### 1. Use WSL2 Filesystem

**Slow** ❌:

```bash
cd /mnt/c/Users/YourName/Projects/ValueOS
```

**Fast** ✅:

```bash
cd ~/Projects/ValueOS
```

**Why**: Native Linux filesystem is 2-5x faster than accessing Windows filesystem through `/mnt/c`.

### 2. Increase Docker Resources

Docker Desktop → Settings → Resources:

- Memory: 6-8 GB (if you have 16GB+ RAM)
- CPUs: 4-6 cores
- Swap: 2 GB
- Disk: 60 GB+

### 3. Exclude from Windows Defender

Add WSL2 filesystem to exclusions:

1. Windows Security → Virus & threat protection
2. Manage settings → Exclusions
3. Add: `%LOCALAPPDATA%\Packages\CanonicalGroupLimited.Ubuntu*`

### 4. Use Windows Terminal

**Download**: Microsoft Store → "Windows Terminal"

**Benefits**:

- Better performance than default console
- Multiple tabs
- GPU acceleration
- Better font rendering

---

## IDE Setup

### VS Code (Recommended)

**Install**: <https://code.visualstudio.com/>

**Extensions**:

```bash
# Install from WSL2
code --install-extension ms-vscode-remote.remote-wsl
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

**Open project**:

```bash
cd ~/Projects/ValueOS
code .
```

**Settings** (`.vscode/settings.json`):

```json
{
  "remote.WSL.fileWatcher.polling": false,
  "files.eol": "\n",
  "terminal.integrated.defaultProfile.windows": "Ubuntu (WSL)"
}
```

---

## Troubleshooting Commands

```bash
# Check WSL version
wsl -l -v

# Restart WSL
wsl --shutdown
# Then reopen Ubuntu

# Check Docker
docker --version
docker ps

# Check Node
node --version
pnpm --version

# Run diagnostics
pnpm run dx:doctor

# View logs
pnpm run dx:logs

# Reset everything
pnpm run dx:clean
pnpm run setup
```

---

## Additional Resources

- **WSL2 Docs**: <https://docs.microsoft.com/en-us/windows/wsl/>
- **Docker Desktop**: <https://docs.docker.com/desktop/windows/wsl/>
- **VS Code + WSL**: <https://code.visualstudio.com/docs/remote/wsl>
- **Node.js on WSL**: <https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl>

---

## Getting Help

If you're still stuck:

1. Run `pnpm run dx:doctor` and share output
2. Check logs: `pnpm run dx:logs`
3. Ask in #engineering on Slack
4. See main troubleshooting: `docs/getting-started/troubleshooting.md`

---

## ValueOS on macOS

*Source: `engineering/platform/MACOS.md`*

**Supported**: macOS 12+ (Monterey, Ventura, Sonoma)
**Architectures**: Intel (x86_64) and Apple Silicon (ARM64/M1/M2/M3)

---

## Quick Start

```bash
# 1. Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install prerequisites
brew install node@20 docker

# 3. Clone and setup
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS
pnpm run setup
npm start
```

---

## Prerequisites

### 1. Homebrew

**Install**:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Verify**:

```bash
brew --version
```

### 2. Node.js 20+

**Install via Homebrew**:

```bash
brew install node@20
```

**Or via nvm** (recommended for multiple versions):

```bash
brew install nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

nvm install 20
nvm use 20
nvm alias default 20
```

**Verify**:

```bash
node --version  # Should be v20.x.x
npm --version
```

### 3. Docker Desktop

**Install**:

```bash
brew install --cask docker
```

**Or download**: <https://docs.docker.com/desktop/mac/install/>

**First Launch**:

1. Open Docker Desktop from Applications
2. Accept terms and conditions
3. Wait for Docker to start (whale icon in menu bar)

**Verify**:

```bash
docker --version
docker ps
```

---

## Apple Silicon (M1/M2/M3) Specific

### Architecture Detection

ValueOS automatically detects Apple Silicon and uses ARM64-optimized images.

**Verify your architecture**:

```bash
uname -m
# arm64 = Apple Silicon
# x86_64 = Intel
```

### Rosetta 2 (Optional)

Some tools may require Rosetta 2 for x86 compatibility:

```bash
softwareupdate --install-rosetta --agree-to-license
```

### Docker Platform

Docker Desktop automatically uses ARM64 images when available. If you encounter issues:

```bash
# Force ARM64 platform
export DOCKER_DEFAULT_PLATFORM=linux/arm64

# Or in docker-compose.yml:
platform: linux/arm64
```

---

## Common Issues

### Issue 1: "Docker daemon not running"

**Symptom**: `Cannot connect to the Docker daemon`

**Solution**:

1. Open Docker Desktop from Applications
2. Wait for whale icon to appear in menu bar
3. Click icon → ensure "Docker Desktop is running"
4. Try again: `docker ps`

### Issue 2: Port already in use

**Symptom**: `EADDRINUSE: address already in use :::5173`

**Solution**:

```bash
# Find process using port
lsof -ti:5173

# Kill process
kill -9 $(lsof -ti:5173)

# Or use different port
VITE_PORT=5174 npm start
```

### Issue 3: Permission denied errors

**Symptom**: `EACCES` when running npm install

**Solution**:

```bash
# Fix npm permissions
sudo chown -R $USER:$(id -gn $USER) ~/.npm
sudo chown -R $USER:$(id -gn $USER) ~/.config

# Or reinstall Node via nvm (recommended)
```

### Issue 4: Command not found after Homebrew install

**Symptom**: `zsh: command not found: node`

**Solution**:

```bash
# Add Homebrew to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Or for Intel Macs
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Reload shell
source ~/.zprofile
```

### Issue 5: Supabase fails to start

**Symptom**: `Error starting Supabase`

**Solution**:

```bash
# Check Docker has enough resources
# Docker Desktop → Settings → Resources:
# - CPUs: 4+
# - Memory: 6GB+
# - Swap: 1GB+

# Reset local stack (Supabase + deps)
pnpm run dx:down
pnpm run dx
```

---

## Performance Tips

### 1. Increase Docker Resources

Docker Desktop → Settings → Resources:

- **CPUs**: 4-6 (out of available)
- **Memory**: 6-8 GB
- **Swap**: 1-2 GB
- **Disk**: 60 GB+

### 2. Enable VirtioFS (Apple Silicon)

Docker Desktop → Settings → General:

- ✅ Enable "VirtioFS accelerated directory sharing"

**Why**: 2-3x faster file I/O

### 3. Exclude from Spotlight

Prevent Spotlight from indexing node_modules:

```bash
# Add to .gitignore
echo "node_modules" >> .gitignore

# Or system-wide
sudo mdutil -i off /path/to/ValueOS/node_modules
```

### 4. Use SSD

Ensure project is on SSD, not external HDD:

```bash
diskutil info / | grep "Solid State"
# Should show: Solid State: Yes
```

---

## IDE Setup

### VS Code (Recommended)

**Install**:

```bash
brew install --cask visual-studio-code
```

**Extensions**:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
```

**Open project**:

```bash
cd ValueOS
code .
```

### Cursor (Alternative)

**Install**:

```bash
brew install --cask cursor
```

---

## Shell Configuration

### Zsh (Default on macOS)

**Recommended additions to `~/.zshrc`**:

```bash
# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

# Aliases
alias dc="docker compose"
alias dps="docker ps"
alias nrs="pnpm run dx"
alias nrd="pnpm run dev"

# Auto-load .env files
export $(cat .env | xargs)
```

---

## Troubleshooting Commands

```bash
# Check system info
uname -m                    # Architecture
sw_vers                     # macOS version

# Check prerequisites
brew --version
node --version
docker --version

# Check Docker
docker ps
docker info

# Check ports
lsof -i :3001               # Backend
lsof -i :5173               # Frontend
lsof -i :54321              # Supabase

# Run diagnostics
pnpm run dx:doctor

# View logs
pnpm run dx:logs

# Reset everything
pnpm run dx:clean
pnpm run setup
```

---

## Upgrading

### Update Homebrew packages

```bash
brew update
brew upgrade node
brew upgrade docker
```

### Update Node.js

```bash
# Via nvm
nvm install 20
nvm use 20

# Via Homebrew
brew upgrade node@20
```

### Update Docker Desktop

```bash
brew upgrade --cask docker
```

---

## Additional Resources

- **Homebrew**: <https://brew.sh/>
- **Docker Desktop for Mac**: <https://docs.docker.com/desktop/mac/install/>
- **Node.js on macOS**: <https://nodejs.org/en/download/package-manager/#macos>
- **Apple Silicon**: <https://support.apple.com/en-us/HT211814>

---

## Getting Help

If you're still stuck:

1. Run `pnpm run dx:doctor` and share output
2. Check logs: `pnpm run dx:logs`
3. Ask in #engineering on Slack
4. See main troubleshooting: `docs/TROUBLESHOOTING.md`

---