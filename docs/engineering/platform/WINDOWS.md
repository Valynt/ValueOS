# ValueOS on Windows

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
npm run setup
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

**Download**: https://docs.docker.com/desktop/windows/install/

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

**Install**: https://code.visualstudio.com/

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
npm --version

# Run diagnostics
npm run doctor

# View logs
npm run logs

# Reset everything
npm run clean
npm run setup
```

---

## Additional Resources

- **WSL2 Docs**: https://docs.microsoft.com/en-us/windows/wsl/
- **Docker Desktop**: https://docs.docker.com/desktop/windows/wsl/
- **VS Code + WSL**: https://code.visualstudio.com/docs/remote/wsl
- **Node.js on WSL**: https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl

---

## Getting Help

If you're still stuck:

1. Run `npm run doctor` and share output
2. Check logs: `npm run logs`
3. Ask in #engineering on Slack
4. See main troubleshooting: `docs/TROUBLESHOOTING.md`
