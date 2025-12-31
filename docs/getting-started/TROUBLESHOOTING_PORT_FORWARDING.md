# Troubleshooting Port Forwarding and Browser Access

This guide helps resolve issues with dev server not being accessible and browser UI testing.

---

## 🔍 Common Issues

### Issue 1: Dev Server Not Accessible

**Symptoms:**
- `npm run dev` runs but browser shows "Can't connect"
- `curl http://localhost:3000` fails
- Port forwarding shows "Not available"

**Causes:**
- Vite not listening on `0.0.0.0`
- Port conflicts
- Firewall blocking connections
- Container networking issues

**Solutions:**

#### Quick Fix
```bash
# Run the auto-fix script
bash scripts/dev-automation/fix-port-forwarding.sh

# Then restart dev server
npm run dev
```

#### Manual Fix

1. **Update Vite Configuration**

Edit `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 3000,
    strictPort: false,
    cors: true,
  },
});
```

2. **Update package.json**

Ensure dev script includes `--host`:
```json
{
  "scripts": {
    "dev": "vite --host"
  }
}
```

3. **Check Port Conflicts**

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process if needed
kill -9 <PID>
```

4. **Restart Dev Server**

```bash
# Stop any running instances
pkill -f vite

# Clear cache
rm -rf node_modules/.vite

# Start fresh
npm run dev
```

---

### Issue 2: Playwright Tests Can't Access UI

**Symptoms:**
- Playwright tests timeout
- "Navigation timeout" errors
- Browser can't connect to dev server

**Causes:**
- Wrong base URL in Playwright config
- Dev server not running
- Browsers not installed
- Container display issues

**Solutions:**

#### Quick Fix
```bash
# Install Playwright browsers
npx playwright install --with-deps

# Run tests with UI mode
npx playwright test --ui

# Or run in headed mode
npx playwright test --headed
```

#### Manual Fix

1. **Update Playwright Configuration**

Edit `playwright.config.ts`:
```typescript
export default defineConfig({
  use: {
    baseURL: 'http://localhost:3000', // Match Vite port
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

2. **Install Browsers**

```bash
# Install all browsers
npx playwright install

# Or install with system dependencies
npx playwright install --with-deps

# Verify installation
npx playwright --version
```

3. **Test Connection**

```bash
# Start dev server
npm run dev

# In another terminal, test connection
curl http://localhost:3000

# Run Playwright tests
npx playwright test
```

---

### Issue 3: Container/Codespace Port Forwarding

**Symptoms:**
- Dev server works in container but not accessible from host
- Forwarded URL shows "Not available"
- Browser can't connect to forwarded port

**Causes:**
- Container not exposing ports
- Port forwarding not configured
- Network isolation

**Solutions:**

#### For Dev Containers

1. **Update devcontainer.json**

```json
{
  "forwardPorts": [3000, 8000, 5432],
  "portsAttributes": {
    "3000": {
      "label": "Frontend",
      "onAutoForward": "notify",
      "visibility": "public"
    }
  }
}
```

2. **Rebuild Container**

```bash
# In VS Code Command Palette (Cmd/Ctrl + Shift + P)
# Select: "Dev Containers: Rebuild Container"
```

#### For Codespaces

1. **Check Port Visibility**

```bash
# List ports
gh codespace ports

# Make port public
gh codespace ports visibility 3000:public
```

2. **Access Forwarded URL**

```bash
# Get Codespace URL
gh codespace list

# Access: https://<codespace-name>-3000.preview.app.github.dev
```

#### For Gitpod

1. **Check Port Status**

```bash
# List ports
gp ports list

# Open port
gp ports open 3000
```

2. **Access URL**

```bash
# Get URL
gp url 3000

# Access the returned URL
```

---

### Issue 4: CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- API requests fail with CORS policy errors
- Cross-origin requests blocked

**Causes:**
- CORS not enabled in Vite
- Wrong origin in requests
- Missing CORS headers

**Solutions:**

1. **Enable CORS in Vite**

```typescript
export default defineConfig({
  server: {
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

2. **Update API Configuration**

```typescript
// In your API client
const apiClient = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
});
```

---

### Issue 5: HMR (Hot Module Replacement) Not Working

**Symptoms:**
- Changes don't reflect in browser
- Need to manually refresh
- "WebSocket connection failed" errors

**Causes:**
- HMR not configured for container
- WebSocket connection issues
- Port mismatch

**Solutions:**

1. **Configure HMR**

```typescript
export default defineConfig({
  server: {
    hmr: {
      clientPort: 3000,
      host: 'localhost',
    },
  },
});
```

2. **For Containers/Codespaces**

```typescript
export default defineConfig({
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
    },
    watch: {
      usePolling: true, // Enable for containers
    },
  },
});
```

---

## 🛠️ Diagnostic Commands

### Check Server Status

```bash
# Check if Vite is running
ps aux | grep vite

# Check listening ports
lsof -i :3000

# Test connection
curl -I http://localhost:3000

# Check network interfaces
ip addr show
```

### Check Container Networking

```bash
# Inside container
hostname -I

# Check if port is bound
netstat -tlnp | grep 3000

# Test from host (if in container)
docker exec <container-id> curl http://localhost:3000
```

### Check Playwright

```bash
# List installed browsers
npx playwright --version

# Test browser launch
npx playwright open https://example.com

# Run with debug
DEBUG=pw:api npx playwright test
```

---

## 📋 Checklist

### Before Starting Development

- [ ] Vite config has `host: '0.0.0.0'`
- [ ] package.json dev script includes `--host`
- [ ] No port conflicts on 3000
- [ ] Firewall allows port 3000
- [ ] Container ports are forwarded
- [ ] Environment variables are set

### Before Running Playwright Tests

- [ ] Dev server is running
- [ ] Can access http://localhost:3000
- [ ] Playwright browsers installed
- [ ] Playwright config has correct baseURL
- [ ] Display is available (for headed mode)

---

## 🚀 Quick Commands

### Start Development

```bash
# Clean start
rm -rf node_modules/.vite
npm run dev

# With specific port
PORT=3001 npm run dev

# With debug logging
DEBUG=vite:* npm run dev
```

### Run Playwright Tests

```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run in headed mode
npx playwright test --headed

# Run specific test
npx playwright test tests/example.spec.ts

# Debug mode
npx playwright test --debug
```

### Port Management

```bash
# Kill process on port
lsof -ti :3000 | xargs kill -9

# Find available port
for port in {3000..3010}; do ! lsof -i :$port && echo "Port $port is available" && break; done

# Forward port (SSH)
ssh -L 3000:localhost:3000 user@remote
```

---

## 🔧 Environment-Specific Solutions

### Local Development

```bash
# Standard setup
npm run dev

# Access
open http://localhost:3000
```

### Docker Container

```bash
# Run with port mapping
docker run -p 3000:3000 -v $(pwd):/app my-image

# Inside container
npm run dev -- --host 0.0.0.0
```

### Dev Container (VS Code)

```json
// .devcontainer/devcontainer.json
{
  "forwardPorts": [3000],
  "postStartCommand": "npm run dev"
}
```

### GitHub Codespaces

```bash
# Ports are auto-forwarded
# Access via: https://<codespace>-3000.preview.app.github.dev

# Make port public if needed
gh codespace ports visibility 3000:public
```

### Gitpod

```yaml
# .gitpod.yml
ports:
  - port: 3000
    onOpen: open-preview
    visibility: public

tasks:
  - command: npm run dev
```

---

## 📊 Performance Tips

### Optimize Dev Server

```typescript
export default defineConfig({
  server: {
    // Faster file watching
    watch: {
      usePolling: false, // Disable for local, enable for containers
    },
    // Optimize HMR
    hmr: {
      overlay: false, // Disable error overlay for performance
    },
  },
  // Optimize build
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
```

### Optimize Playwright

```typescript
export default defineConfig({
  // Run tests in parallel
  fullyParallel: true,
  workers: 4,
  
  // Reduce retries
  retries: 0,
  
  // Optimize timeouts
  use: {
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },
});
```

---

## 🆘 Still Having Issues?

### Collect Diagnostic Information

```bash
# Run diagnostic script
bash scripts/dev-automation/dev-health-check.sh > diagnostic.txt

# Include:
# - OS and version
# - Node.js version
# - npm version
# - Docker version (if applicable)
# - Error messages
# - Screenshots
```

### Get Help

1. **Check logs**
   ```bash
   # Vite logs
   npm run dev 2>&1 | tee vite.log
   
   # Playwright logs
   DEBUG=pw:* npx playwright test 2>&1 | tee playwright.log
   ```

2. **Search issues**
   - [Vite Issues](https://github.com/vitejs/vite/issues)
   - [Playwright Issues](https://github.com/microsoft/playwright/issues)

3. **Ask for help**
   - Slack: #dev-support
   - Email: dev-team@valuecanvas.com

---

**Last Updated:** 2025-12-06  
**Version:** 1.0.0
