# ValueOS on macOS

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
